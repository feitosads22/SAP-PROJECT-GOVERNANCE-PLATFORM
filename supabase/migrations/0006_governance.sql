-- =====================================================================
-- Fase 5 — Governança Avançada: Riscos, Issues, Change Requests
-- Arquivo : 0006_governance.sql
-- Aplicar : APÓS 0005b_task_activate_timesheet_reject.sql
-- Rollback: 0006_governance_down.sql
-- =====================================================================

begin;
set check_function_bodies = off;

-- ---------------------------------------------------------------
-- 1. project_risks
-- ---------------------------------------------------------------
create table if not exists public.project_risks (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  project_id       uuid not null references public.projects(id) on delete cascade,
  title            text not null,
  description      text,
  category         text check (category in (
                     'scope','schedule','budget','resource',
                     'technical','external','other')),
  probability      text not null default 'medium'
                   check (probability in ('low','medium','high','critical')),
  impact           text not null default 'medium'
                   check (impact in ('low','medium','high','critical')),
  score            int generated always as (
                     case probability when 'low' then 1 when 'medium' then 2
                       when 'high' then 3 when 'critical' then 4 end *
                     case impact     when 'low' then 1 when 'medium' then 2
                       when 'high' then 3 when 'critical' then 4 end
                   ) stored,
  owner_id         uuid references public.profiles(id) on delete set null,
  due_date         date,
  mitigation_plan  text,
  contingency_plan text,
  status           text not null default 'identified'
                   check (status in ('identified','analyzing','mitigating',
                                     'resolved','accepted')),
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists project_risks_org_idx     on public.project_risks (organization_id);
create index if not exists project_risks_project_idx on public.project_risks (project_id);
create index if not exists project_risks_score_idx   on public.project_risks (project_id, score desc);

-- ---------------------------------------------------------------
-- 2. project_issues
-- ---------------------------------------------------------------
create table if not exists public.project_issues (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  title           text not null,
  description     text,
  priority        text not null default 'medium'
                  check (priority in ('low','medium','high','critical')),
  impact          text,
  owner_id        uuid references public.profiles(id) on delete set null,
  due_date        date,
  status          text not null default 'open'
                  check (status in ('open','in_progress','resolved','closed','cancelled')),
  resolution      text,
  resolved_at     timestamptz,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists project_issues_org_idx     on public.project_issues (organization_id);
create index if not exists project_issues_project_idx on public.project_issues (project_id);
create index if not exists project_issues_status_idx  on public.project_issues (project_id, status);

-- ---------------------------------------------------------------
-- 3. change_requests
-- ---------------------------------------------------------------
create sequence if not exists public.cr_number_seq start 1;

create table if not exists public.change_requests (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  project_id           uuid not null references public.projects(id) on delete cascade,
  number               int not null default nextval('public.cr_number_seq'),
  title                text not null,
  description          text,
  justification        text,
  additional_hours     numeric(8,2)  not null default 0,
  additional_cost      numeric(14,2) not null default 0,
  schedule_impact_days int           not null default 0,
  scope_impact         text,
  requested_by         uuid references public.profiles(id) on delete set null,
  approved_by          uuid references public.profiles(id) on delete set null,
  approved_at          timestamptz,
  status               text not null default 'draft'
                       check (status in ('draft','submitted','approved',
                                         'rejected','cancelled')),
  rejection_reason     text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists change_requests_org_idx     on public.change_requests (organization_id);
create index if not exists change_requests_project_idx on public.change_requests (project_id);

-- ---------------------------------------------------------------
-- 4. Trigger: ao aprovar CR, atualiza budget e end_date no banco
-- ---------------------------------------------------------------
create or replace function public.apply_change_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status != 'approved' then
    -- Atualiza orçamento
    update public.project_budgets
       set budget_total = budget_total + new.additional_cost,
           updated_at   = now()
     where project_id = new.project_id;

    -- Atualiza end_date do projeto
    update public.projects
       set end_date  = end_date + (new.schedule_impact_days || ' days')::interval,
           updated_at = now()
     where id = new.project_id
       and new.schedule_impact_days > 0;

    -- Audit log
    perform public.create_audit_log(
      new.organization_id, auth.uid(),
      'approve', 'change_request', new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status,
                         'additional_cost', new.additional_cost,
                         'schedule_impact_days', new.schedule_impact_days)
    );

    -- Notifica o solicitante
    if new.requested_by is not null then
      perform public.create_notification(
        new.organization_id, new.requested_by,
        'cr_approved',
        'Change Request aprovado: ' || new.title,
        null, 'change_request', new.id
      );
    end if;
  end if;

  if new.status = 'rejected' and old.status != 'rejected' then
    perform public.create_audit_log(
      new.organization_id, auth.uid(),
      'reject', 'change_request', new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status,
                         'rejection_reason', new.rejection_reason)
    );
    if new.requested_by is not null then
      perform public.create_notification(
        new.organization_id, new.requested_by,
        'cr_rejected',
        'Change Request rejeitado: ' || new.title,
        coalesce('Motivo: ' || new.rejection_reason, null),
        'change_request', new.id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_change_requests_apply on public.change_requests;
create trigger trg_change_requests_apply
  after update on public.change_requests
  for each row execute function public.apply_change_request();

-- ---------------------------------------------------------------
-- 5. Triggers updated_at e tenancy
-- ---------------------------------------------------------------
drop trigger if exists trg_project_risks_updated_at   on public.project_risks;
drop trigger if exists trg_project_issues_updated_at  on public.project_issues;
drop trigger if exists trg_change_requests_updated_at on public.change_requests;
drop trigger if exists trg_project_risks_org_id       on public.project_risks;
drop trigger if exists trg_project_issues_org_id      on public.project_issues;
drop trigger if exists trg_change_requests_org_id     on public.change_requests;

create trigger trg_project_risks_updated_at
  before update on public.project_risks
  for each row execute function public.set_updated_at();

create trigger trg_project_issues_updated_at
  before update on public.project_issues
  for each row execute function public.set_updated_at();

create trigger trg_change_requests_updated_at
  before update on public.change_requests
  for each row execute function public.set_updated_at();

create trigger trg_project_risks_org_id
  before insert on public.project_risks
  for each row execute function public.set_org_id();

create trigger trg_project_issues_org_id
  before insert on public.project_issues
  for each row execute function public.set_org_id();

create trigger trg_change_requests_org_id
  before insert on public.change_requests
  for each row execute function public.set_org_id();

-- ---------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------
alter table public.project_risks   enable row level security;
alter table public.project_issues  enable row level security;
alter table public.change_requests enable row level security;

-- project_risks: todos na org leem; só admin/manager criam/editam
drop policy if exists project_risks_select on public.project_risks;
drop policy if exists project_risks_insert on public.project_risks;
drop policy if exists project_risks_update on public.project_risks;
drop policy if exists project_risks_delete on public.project_risks;

create policy project_risks_select on public.project_risks
  for select using (organization_id = public.current_org_id());

create policy project_risks_insert on public.project_risks
  for insert with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));

create policy project_risks_update on public.project_risks
  for update using (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'))
  with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));

create policy project_risks_delete on public.project_risks
  for delete using (organization_id = public.current_org_id()
    and public.current_role() = 'admin');

-- project_issues
drop policy if exists project_issues_select on public.project_issues;
drop policy if exists project_issues_insert on public.project_issues;
drop policy if exists project_issues_update on public.project_issues;
drop policy if exists project_issues_delete on public.project_issues;

create policy project_issues_select on public.project_issues
  for select using (organization_id = public.current_org_id());

create policy project_issues_insert on public.project_issues
  for insert with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager','consultant'));

create policy project_issues_update on public.project_issues
  for update using (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager','consultant'))
  with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager','consultant'));

create policy project_issues_delete on public.project_issues
  for delete using (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));

-- change_requests
drop policy if exists change_requests_select on public.change_requests;
drop policy if exists change_requests_insert on public.change_requests;
drop policy if exists change_requests_update on public.change_requests;
drop policy if exists change_requests_delete on public.change_requests;

create policy change_requests_select on public.change_requests
  for select using (organization_id = public.current_org_id());

create policy change_requests_insert on public.change_requests
  for insert with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager','consultant'));

create policy change_requests_update on public.change_requests
  for update using (organization_id = public.current_org_id()
    and (
      public.current_role() in ('admin','manager')
      or (public.current_role() = 'consultant' and status = 'draft'
          and requested_by = auth.uid())
    ))
  with check (organization_id = public.current_org_id());

create policy change_requests_delete on public.change_requests
  for delete using (organization_id = public.current_org_id()
    and public.current_role() = 'admin');

-- ---------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------
grant select, insert, update, delete on public.project_risks   to authenticated;
grant select, insert, update, delete on public.project_issues  to authenticated;
grant select, insert, update, delete on public.change_requests to authenticated;

commit;
