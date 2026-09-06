-- =====================================================================
-- Fase 6 — Project Health Score + Portfolio
-- Arquivo : 0007_portfolio_health.sql
-- Aplicar : APÓS 0006_governance.sql
-- Rollback: 0007_portfolio_health_down.sql
-- =====================================================================

begin;
set check_function_bodies = off;

-- ---------------------------------------------------------------
-- 1. project_health_scores — snapshots imutáveis
-- ---------------------------------------------------------------
create table if not exists public.project_health_scores (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  project_id        uuid not null references public.projects(id) on delete cascade,
  score             numeric(5,2) not null check (score between 0 and 100),
  score_prazo       numeric(5,2),
  score_budget      numeric(5,2),
  score_riscos      numeric(5,2),
  score_issues      numeric(5,2),
  score_evidencias  numeric(5,2),
  status            text not null
                    check (status in ('critical','at_risk','attention','healthy')),
  calculated_at     timestamptz not null default now()
);

create index if not exists health_scores_org_idx     on public.project_health_scores (organization_id);
create index if not exists health_scores_project_idx on public.project_health_scores (project_id, calculated_at desc);

-- ---------------------------------------------------------------
-- 2. Function: calcula health score e persiste snapshot
-- ---------------------------------------------------------------
create or replace function public.calculate_health_score(p_project_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org       uuid;
  v_project   record;
  v_budget    record;

  -- componentes (0–100 cada)
  s_prazo      numeric := 100;
  s_budget     numeric := 100;
  s_riscos     numeric := 100;
  s_issues     numeric := 100;
  s_evidencias numeric := 100;

  v_score      numeric;
  v_status     text;

  -- helpers
  total_days   numeric;
  elapsed_days numeric;
  used_pct     numeric;
  risk_cnt     int;
  issue_cnt    int;
  ev_pending   int;
  ev_total     int;
begin
  -- Dados do projeto
  select * into v_project from public.projects where id = p_project_id;
  if not found then return null; end if;
  v_org := v_project.organization_id;

  -- ── Prazo (25%) ────────────────────────────────────────────────
  if v_project.start_date is not null and v_project.end_date is not null then
    total_days   := v_project.end_date - v_project.start_date;
    elapsed_days := current_date - v_project.start_date;
    if total_days > 0 then
      used_pct := elapsed_days / total_days;
      -- penaliza quando tempo decorrido > progresso do projeto
      if used_pct <= 1 then
        s_prazo := greatest(0, 100 - greatest(0, (used_pct - v_project.progress / 100.0) * 200));
      else
        -- projeto atrasado
        s_prazo := greatest(0, 100 - (used_pct - 1) * 100 - 20);
      end if;
    end if;
  end if;

  -- ── Budget (25%) ───────────────────────────────────────────────
  select * into v_budget from public.project_financial where project_id = p_project_id;
  if found and v_budget.budget_total > 0 then
    used_pct := v_budget.cost_actual_total / v_budget.budget_total;
    if used_pct <= 0.85 then
      s_budget := 100;
    elsif used_pct <= 1 then
      s_budget := 100 - (used_pct - 0.85) / 0.15 * 30;
    else
      s_budget := greatest(0, 70 - (used_pct - 1) * 100);
    end if;
  end if;

  -- ── Riscos (20%) ───────────────────────────────────────────────
  select count(*) into risk_cnt
    from public.project_risks
   where project_id = p_project_id
     and status not in ('resolved','accepted')
     and score >= 9;   -- high×high ou pior

  s_riscos := greatest(0, 100 - risk_cnt * 25);

  -- ── Issues (15%) ───────────────────────────────────────────────
  select count(*) into issue_cnt
    from public.project_issues
   where project_id = p_project_id
     and status in ('open','in_progress')
     and priority in ('high','critical');

  s_issues := greatest(0, 100 - issue_cnt * 20);

  -- ── Evidências (15%) ───────────────────────────────────────────
  select count(*) into ev_total
    from public.tasks
   where project_id = p_project_id
     and requires_evidence = true
     and status not in ('completed','cancelled');

  if ev_total > 0 then
    select count(*) into ev_pending
      from public.tasks t
     where t.project_id = p_project_id
       and t.requires_evidence = true
       and t.status not in ('completed','cancelled')
       and not exists (
         select 1 from public.task_evidences te
          where te.task_id = t.id and te.status = 'approved'
       );
    s_evidencias := greatest(0, 100 - (ev_pending::numeric / ev_total) * 100);
  end if;

  -- ── Score final ponderado ──────────────────────────────────────
  v_score := round(
    s_prazo      * 0.25 +
    s_budget     * 0.25 +
    s_riscos     * 0.20 +
    s_issues     * 0.15 +
    s_evidencias * 0.15
  , 1);

  v_status := case
    when v_score >= 85 then 'healthy'
    when v_score >= 70 then 'attention'
    when v_score >= 50 then 'at_risk'
    else 'critical'
  end;

  -- Persiste snapshot
  insert into public.project_health_scores
    (organization_id, project_id, score,
     score_prazo, score_budget, score_riscos, score_issues, score_evidencias,
     status)
  values
    (v_org, p_project_id, v_score,
     round(s_prazo,1), round(s_budget,1), round(s_riscos,1),
     round(s_issues,1), round(s_evidencias,1),
     v_status);

  return v_score;
end;
$$;

-- ---------------------------------------------------------------
-- 3. View portfolio_summary — visão executiva
-- ---------------------------------------------------------------
create or replace view public.portfolio_summary as
select
  p.id                                             as project_id,
  p.organization_id,
  p.name                                           as project_name,
  p.code                                           as project_code,
  p.status                                         as project_status,
  p.priority                                       as project_priority,
  p.progress,
  p.start_date,
  p.end_date,
  p.sap_module,

  -- health score mais recente
  (select hs.score
     from public.project_health_scores hs
    where hs.project_id = p.id
    order by hs.calculated_at desc limit 1)        as health_score,

  (select hs.status
     from public.project_health_scores hs
    where hs.project_id = p.id
    order by hs.calculated_at desc limit 1)        as health_status,

  (select hs.calculated_at
     from public.project_health_scores hs
    where hs.project_id = p.id
    order by hs.calculated_at desc limit 1)        as health_calculated_at,

  -- financeiro
  coalesce(pf.budget_total, 0)                     as budget_total,
  coalesce(pf.cost_actual_total, 0)                as cost_actual,
  coalesce(pf.cost_forecast, 0)                    as cost_forecast,
  coalesce(pf.variance_pct, 0)                     as variance_pct,
  coalesce(pf.margin_pct, 0)                       as margin_pct,
  pf.financial_status,

  -- contadores
  (select count(*) from public.tasks t
    where t.project_id = p.id
      and t.status not in ('completed','cancelled'))  as tasks_open,

  (select count(*) from public.tasks t
    where t.project_id = p.id
      and t.status = 'completed')                    as tasks_done,

  (select count(*) from public.project_risks r
    where r.project_id = p.id
      and r.status not in ('resolved','accepted')
      and r.score >= 9)                              as risks_critical,

  (select count(*) from public.project_issues i
    where i.project_id = p.id
      and i.status in ('open','in_progress'))        as issues_open,

  (select count(*) from public.change_requests cr
    where cr.project_id = p.id
      and cr.status = 'submitted')                   as crs_pending,

  -- prazo
  case
    when p.end_date is null          then 'sem_prazo'
    when p.end_date < current_date
         and p.status = 'active'     then 'atrasado'
    when p.end_date < current_date + 14
         and p.status = 'active'     then 'critico'
    else 'ok'
  end                                                as schedule_status,

  p.end_date - current_date                          as days_remaining

from public.projects p
left join public.project_financial pf on pf.project_id = p.id;

-- ---------------------------------------------------------------
-- 4. RLS — project_health_scores
--    SELECT para todos na org; escrita só via function SECURITY DEFINER
-- ---------------------------------------------------------------
alter table public.project_health_scores enable row level security;

create policy health_scores_select on public.project_health_scores
  for select using (organization_id = public.current_org_id());

-- bloqueia insert/update/delete direto do frontend
create policy health_scores_no_insert on public.project_health_scores
  for insert with check (false);

-- ---------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------
grant select on public.project_health_scores to authenticated;
grant select on public.portfolio_summary      to authenticated;
grant execute on function public.calculate_health_score(uuid) to authenticated;

commit;
