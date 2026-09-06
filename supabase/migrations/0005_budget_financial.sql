-- =====================================================================
-- Fase 4 — Orçamento + Custos + Forecast
-- Arquivo : 0005_budget_financial.sql
-- Aplicar : APÓS 0004_resources_timesheet.sql
-- Rollback: 0005_budget_financial_down.sql
-- =====================================================================

begin;
set check_function_bodies = off;

-- ---------------------------------------------------------------
-- 1. project_budgets
-- ---------------------------------------------------------------
create table if not exists public.project_budgets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null unique references public.projects(id) on delete cascade,
  budget_total    numeric(14,2) not null check (budget_total >= 0),
  revenue_planned numeric(14,2) default 0 check (revenue_planned >= 0),
  cost_planned    numeric(14,2) default 0 check (cost_planned >= 0),
  contingency_pct numeric(5,2)  default 0 check (contingency_pct >= 0 and contingency_pct <= 100),
  currency        text not null default 'BRL',
  approved_by     uuid references public.profiles(id) on delete set null,
  approved_at     timestamptz,
  notes           text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists project_budgets_org_idx on public.project_budgets (organization_id);

-- ---------------------------------------------------------------
-- 2. project_costs
-- ---------------------------------------------------------------
create table if not exists public.project_costs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  category        text not null
                  check (category in ('labor','travel','software','hardware',
                                      'training','consulting','other')),
  description     text not null,
  amount          numeric(14,2) not null check (amount >= 0),
  cost_date       date not null default current_date,
  approved_by     uuid references public.profiles(id) on delete set null,
  approved_at     timestamptz,
  receipt_path    text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists project_costs_org_idx     on public.project_costs (organization_id);
create index if not exists project_costs_project_idx on public.project_costs (project_id);
create index if not exists project_costs_date_idx    on public.project_costs (project_id, cost_date desc);

-- ---------------------------------------------------------------
-- 3. project_forecasts (imutável após criação)
-- ---------------------------------------------------------------
create table if not exists public.project_forecasts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  project_id       uuid not null references public.projects(id) on delete cascade,
  forecast_date    date not null default current_date,
  cost_forecast    numeric(14,2) not null check (cost_forecast >= 0),
  revenue_forecast numeric(14,2) default 0,
  completion_pct   numeric(5,2)  default 0
                   check (completion_pct >= 0 and completion_pct <= 100),
  notes            text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists project_forecasts_org_idx     on public.project_forecasts (organization_id);
create index if not exists project_forecasts_project_idx on public.project_forecasts (project_id, forecast_date desc);

-- ---------------------------------------------------------------
-- 4. View financeira consolidada
-- ---------------------------------------------------------------
create or replace view public.project_financial as
select
  p.id                                            as project_id,
  p.organization_id,
  p.name                                          as project_name,
  p.code                                          as project_code,
  p.status                                        as project_status,
  p.progress,
  coalesce(pb.budget_total, 0)                    as budget_total,
  coalesce(pb.revenue_planned, 0)                 as revenue_planned,
  coalesce(pb.cost_planned, 0)                    as cost_planned,
  coalesce(pb.contingency_pct, 0)                 as contingency_pct,
  pb.currency,
  pb.approved_at                                  as budget_approved_at,
  coalesce((select sum(pc.amount)
              from public.project_costs pc
             where pc.project_id = p.id), 0)      as cost_actual_manual,
  coalesce((select sum(t.hours * r.hourly_rate)
              from public.timesheets t
              join public.resources r on r.id = t.resource_id
             where t.project_id = p.id
               and r.hourly_rate is not null), 0) as cost_actual_labor,
  coalesce((select sum(pc.amount)
              from public.project_costs pc
             where pc.project_id = p.id), 0) +
  coalesce((select sum(t.hours * r.hourly_rate)
              from public.timesheets t
              join public.resources r on r.id = t.resource_id
             where t.project_id = p.id
               and r.hourly_rate is not null), 0) as cost_actual_total,
  coalesce((select pf.cost_forecast
              from public.project_forecasts pf
             where pf.project_id = p.id
             order by pf.forecast_date desc, pf.created_at desc
             limit 1), 0)                         as cost_forecast,
  coalesce((select pf.revenue_forecast
              from public.project_forecasts pf
             where pf.project_id = p.id
             order by pf.forecast_date desc, pf.created_at desc
             limit 1), 0)                         as revenue_forecast,
  -- variance (positivo = dentro do orçamento)
  coalesce(pb.budget_total, 0) - (
    coalesce((select sum(pc.amount) from public.project_costs pc where pc.project_id = p.id), 0) +
    coalesce((select sum(t.hours * r.hourly_rate) from public.timesheets t
               join public.resources r on r.id = t.resource_id
              where t.project_id = p.id and r.hourly_rate is not null), 0)
  )                                               as variance,
  case when coalesce(pb.budget_total, 0) > 0 then
    round((coalesce(pb.budget_total, 0) - (
      coalesce((select sum(pc.amount) from public.project_costs pc where pc.project_id = p.id), 0) +
      coalesce((select sum(t.hours * r.hourly_rate) from public.timesheets t
                 join public.resources r on r.id = t.resource_id
                where t.project_id = p.id and r.hourly_rate is not null), 0)
    )) / pb.budget_total * 100, 1) else null end  as variance_pct,
  -- margem
  coalesce(pb.revenue_planned, 0) - (
    coalesce((select sum(pc.amount) from public.project_costs pc where pc.project_id = p.id), 0) +
    coalesce((select sum(t.hours * r.hourly_rate) from public.timesheets t
               join public.resources r on r.id = t.resource_id
              where t.project_id = p.id and r.hourly_rate is not null), 0)
  )                                               as margin,
  case when coalesce(pb.revenue_planned, 0) > 0 then
    round((coalesce(pb.revenue_planned, 0) - (
      coalesce((select sum(pc.amount) from public.project_costs pc where pc.project_id = p.id), 0) +
      coalesce((select sum(t.hours * r.hourly_rate) from public.timesheets t
                 join public.resources r on r.id = t.resource_id
                where t.project_id = p.id and r.hourly_rate is not null), 0)
    )) / pb.revenue_planned * 100, 1) else null end as margin_pct,
  -- status financeiro
  case
    when coalesce(pb.budget_total, 0) = 0 then 'sem_orcamento'
    when (
      coalesce((select sum(pc.amount) from public.project_costs pc where pc.project_id = p.id), 0) +
      coalesce((select sum(t.hours * r.hourly_rate) from public.timesheets t
                 join public.resources r on r.id = t.resource_id
                where t.project_id = p.id and r.hourly_rate is not null), 0)
    ) > coalesce(pb.budget_total, 0)              then 'estourado'
    when (
      coalesce((select sum(pc.amount) from public.project_costs pc where pc.project_id = p.id), 0) +
      coalesce((select sum(t.hours * r.hourly_rate) from public.timesheets t
                 join public.resources r on r.id = t.resource_id
                where t.project_id = p.id and r.hourly_rate is not null), 0)
    ) > coalesce(pb.budget_total, 0) * 0.85       then 'atencao'
    else 'ok'
  end                                             as financial_status
from public.projects p
left join public.project_budgets pb on pb.project_id = p.id;

-- ---------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------
drop trigger if exists trg_project_budgets_updated_at   on public.project_budgets;
drop trigger if exists trg_project_costs_updated_at     on public.project_costs;
drop trigger if exists trg_project_budgets_org_id       on public.project_budgets;
drop trigger if exists trg_project_costs_org_id         on public.project_costs;
drop trigger if exists trg_project_forecasts_org_id     on public.project_forecasts;

create trigger trg_project_budgets_updated_at
  before update on public.project_budgets
  for each row execute function public.set_updated_at();

create trigger trg_project_costs_updated_at
  before update on public.project_costs
  for each row execute function public.set_updated_at();

create trigger trg_project_budgets_org_id
  before insert on public.project_budgets
  for each row execute function public.set_org_id();

create trigger trg_project_costs_org_id
  before insert on public.project_costs
  for each row execute function public.set_org_id();

create trigger trg_project_forecasts_org_id
  before insert on public.project_forecasts
  for each row execute function public.set_org_id();

-- audit ao aprovar orçamento
create or replace function public.log_budget_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.approved_by is not null and old.approved_by is null then
    perform public.create_audit_log(
      old.organization_id, auth.uid(), 'approve', 'budget', old.id,
      jsonb_build_object('approved_by', null, 'budget_total', old.budget_total),
      jsonb_build_object('approved_by', new.approved_by, 'budget_total', new.budget_total)
    );
  end if;
  return new;
end; $$;

drop trigger if exists trg_project_budgets_audit on public.project_budgets;
create trigger trg_project_budgets_audit
  after update on public.project_budgets
  for each row execute function public.log_budget_approval();

-- ---------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------
alter table public.project_budgets   enable row level security;
alter table public.project_costs     enable row level security;
alter table public.project_forecasts enable row level security;

drop policy if exists project_budgets_select   on public.project_budgets;
drop policy if exists project_budgets_insert   on public.project_budgets;
drop policy if exists project_budgets_update   on public.project_budgets;
drop policy if exists project_budgets_delete   on public.project_budgets;
drop policy if exists project_costs_select     on public.project_costs;
drop policy if exists project_costs_insert     on public.project_costs;
drop policy if exists project_costs_update     on public.project_costs;
drop policy if exists project_costs_delete     on public.project_costs;
drop policy if exists project_forecasts_select on public.project_forecasts;
drop policy if exists project_forecasts_insert on public.project_forecasts;
drop policy if exists project_forecasts_delete on public.project_forecasts;

create policy project_budgets_select on public.project_budgets
  for select using (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager','consultant'));
create policy project_budgets_insert on public.project_budgets
  for insert with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));
create policy project_budgets_update on public.project_budgets
  for update using (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'))
  with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));
create policy project_budgets_delete on public.project_budgets
  for delete using (organization_id = public.current_org_id()
    and public.current_role() = 'admin');

create policy project_costs_select on public.project_costs
  for select using (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager','consultant'));
create policy project_costs_insert on public.project_costs
  for insert with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));
create policy project_costs_update on public.project_costs
  for update using (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'))
  with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));
create policy project_costs_delete on public.project_costs
  for delete using (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));

create policy project_forecasts_select on public.project_forecasts
  for select using (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager','consultant'));
create policy project_forecasts_insert on public.project_forecasts
  for insert with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));
create policy project_forecasts_delete on public.project_forecasts
  for delete using (organization_id = public.current_org_id()
    and public.current_role() = 'admin');

-- ---------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------
grant select, insert, update, delete on public.project_budgets   to authenticated;
grant select, insert, update, delete on public.project_costs     to authenticated;
grant select, insert, update, delete on public.project_forecasts to authenticated;
grant select on public.project_financial to authenticated;

commit;
