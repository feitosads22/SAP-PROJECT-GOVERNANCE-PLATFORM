-- =====================================================================
-- Fase 1A — Fundação: Auth + Organizações + Projetos
-- Arquivo : 0001_foundation_auth_orgs_projects.sql
-- Projeto : SAP Project Governance Platform (multi-tenant)
-- Regra   : toda tabela de negócio possui organization_id + RLS.
-- =====================================================================

begin;

-- PostgreSQL valida o corpo de funções LANGUAGE sql no CREATE.
-- Desligamos a checagem para não depender da ordem das instruções.
set check_function_bodies = off;

-- ---------------------------------------------------------------
-- Extensões
-- ---------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- organizations (tenancy)
-- ---------------------------------------------------------------
create table if not exists public.organizations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  sap_client_number text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- profiles (1:1 com auth.users)
-- role 'pending' = recém-cadastrado, ainda sem organização
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  role            text not null default 'pending'
                  check (role in ('pending','admin','manager','consultant','customer')),
  full_name       text,
  email           text,
  avatar_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists profiles_organization_id_idx on public.profiles (organization_id);

-- ---------------------------------------------------------------
-- Helpers de tenancy
-- SECURITY DEFINER (owner = postgres) para evitar recursão de RLS
-- nas policies da própria tabela profiles.
-- ---------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.organization_id
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

-- ---------------------------------------------------------------
-- Trigger: novo auth.user -> cria profile 'pending'
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------
create table if not exists public.projects (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  name              text not null,
  code              text not null,
  description       text,
  status            text not null default 'draft'
                    check (status in ('draft','active','on_hold','completed','cancelled')),
  priority          text not null default 'medium'
                    check (priority in ('low','medium','high','critical')),
  manager_id        uuid references public.profiles(id) on delete set null,
  customer_id       uuid references public.profiles(id) on delete set null,
  sap_module        text,
  start_date        date,
  end_date          date,
  actual_start_date date,
  actual_end_date   date,
  progress          numeric(5,2) not null default 0 check (progress between 0 and 100),
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint projects_dates_check check (end_date is null or start_date is null or end_date >= start_date),
  constraint projects_org_code_unique unique (organization_id, code)
);

create index if not exists projects_organization_id_idx on public.projects (organization_id);
create index if not exists projects_manager_id_idx     on public.projects (manager_id);

-- ---------------------------------------------------------------
-- project_modules (módulos SAP do projeto)
-- ---------------------------------------------------------------
create table if not exists public.project_modules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  name            text not null,
  code            text not null,
  sap_module      text,
  description     text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists project_modules_organization_id_idx on public.project_modules (organization_id);
create index if not exists project_modules_project_id_idx       on public.project_modules (project_id);

-- ---------------------------------------------------------------
-- wbs_items (estrutura hierárquica, code ex: 1.2.3)
-- ---------------------------------------------------------------
create table if not exists public.wbs_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  parent_id       uuid references public.wbs_items(id) on delete cascade,
  code            text not null,
  name            text not null,
  description     text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists wbs_items_organization_id_idx on public.wbs_items (organization_id);
create index if not exists wbs_items_project_id_idx       on public.wbs_items (project_id, parent_id);

-- ---------------------------------------------------------------
-- phases (fases do projeto)
-- ---------------------------------------------------------------
create table if not exists public.phases (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  name            text not null,
  code            text not null,
  description     text,
  start_date      date,
  end_date        date,
  status          text not null default 'not_started'
                  check (status in ('not_started','in_progress','completed','cancelled')),
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists phases_organization_id_idx on public.phases (organization_id);
create index if not exists phases_project_id_idx       on public.phases (project_id);

-- ---------------------------------------------------------------
-- milestones
-- ---------------------------------------------------------------
create table if not exists public.milestones (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  phase_id        uuid references public.phases(id) on delete set null,
  name            text not null,
  description     text,
  due_date        date,
  status          text not null default 'not_started'
                  check (status in ('not_started','in_progress','completed','cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists milestones_organization_id_idx on public.milestones (organization_id);
create index if not exists milestones_project_id_idx       on public.milestones (project_id);

-- ---------------------------------------------------------------
-- tasks (kanban: TODO -> IN PROGRESS -> BLOCKED -> VALIDATION
--        -> ADJUSTMENT REQUIRED -> COMPLETED / CANCELLED)
-- ---------------------------------------------------------------
create table if not exists public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  project_id         uuid not null references public.projects(id) on delete cascade,
  module_id          uuid references public.project_modules(id) on delete set null,
  phase_id           uuid references public.phases(id) on delete set null,
  wbs_id             uuid references public.wbs_items(id) on delete set null,
  parent_task_id     uuid references public.tasks(id) on delete cascade,
  title              text not null,
  description        text,
  status             text not null default 'todo'
                     check (status in ('todo','in_progress','blocked','validation',
                                       'adjustment_required','completed','cancelled')),
  priority           text not null default 'medium'
                     check (priority in ('low','medium','high','critical')),
  assignee_id        uuid references public.profiles(id) on delete set null,
  reviewer_id        uuid references public.profiles(id) on delete set null,
  planned_start_date date,
  planned_end_date   date,
  estimated_hours    numeric(8,2) not null default 0 check (estimated_hours >= 0),
  progress           numeric(5,2) not null default 0 check (progress between 0 and 100),
  requires_evidence  boolean not null default false,
  completed_at       timestamptz,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint tasks_dates_check check (planned_end_date is null or planned_start_date is null
                                      or planned_end_date >= planned_start_date)
);

create index if not exists tasks_organization_id_idx  on public.tasks (organization_id);
create index if not exists tasks_project_id_idx       on public.tasks (project_id);
create index if not exists tasks_assignee_id_idx      on public.tasks (assignee_id);
create index if not exists tasks_status_idx           on public.tasks (status);

-- ---------------------------------------------------------------
-- task_dependencies
-- ---------------------------------------------------------------
create table if not exists public.task_dependencies (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  task_id          uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  dependency_type  text not null default 'finish_to_start'
                   check (dependency_type in ('finish_to_start','finish_to_finish',
                                              'start_to_start','start_to_finish')),
  created_at       timestamptz not null default now(),
  constraint task_dependencies_unique unique (task_id, depends_on_task_id)
);

create index if not exists task_dependencies_organization_id_idx on public.task_dependencies (organization_id);
create index if not exists task_dependencies_task_id_idx          on public.task_dependencies (task_id);

-- ---------------------------------------------------------------
-- task_history (auditoria de mudanças — escrita só via trigger)
-- ---------------------------------------------------------------
create table if not exists public.task_history (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id         uuid not null references public.tasks(id) on delete cascade,
  changed_by      uuid references public.profiles(id) on delete set null,
  field           text not null,
  old_value       text,
  new_value       text,
  created_at      timestamptz not null default now()
);

create index if not exists task_history_organization_id_idx on public.task_history (organization_id);
create index if not exists task_history_task_id_idx          on public.task_history (task_id);

-- =====================================================================
-- Trigger de tenancy: força organization_id = current_org_id() na INSERT
-- Impede spoofing: o cliente envia o que quiser, o banco corrige.
-- =====================================================================
create or replace function public.set_org_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  org_id uuid := public.current_org_id();
begin
  -- Sobrepõe somente quando há usuário autenticado COM organização.
  -- Usuário sem org: RLS (WITH CHECK) nega o insert. Operações feitas
  -- como postgres (seed/administração) preservam o valor informado.
  if org_id is not null then
    new.organization_id := org_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projects_set_org_id     on public.projects;
drop trigger if exists trg_modules_set_org_id      on public.project_modules;
drop trigger if exists trg_wbs_set_org_id          on public.wbs_items;
drop trigger if exists trg_phases_set_org_id       on public.phases;
drop trigger if exists trg_milestones_set_org_id   on public.milestones;
drop trigger if exists trg_tasks_set_org_id        on public.tasks;
drop trigger if exists trg_dependencies_set_org_id on public.task_dependencies;

create trigger trg_projects_set_org_id        before insert on public.projects          for each row execute function public.set_org_id();
create trigger trg_modules_set_org_id         before insert on public.project_modules   for each row execute function public.set_org_id();
create trigger trg_wbs_set_org_id             before insert on public.wbs_items         for each row execute function public.set_org_id();
create trigger trg_phases_set_org_id          before insert on public.phases            for each row execute function public.set_org_id();
create trigger trg_milestones_set_org_id      before insert on public.milestones        for each row execute function public.set_org_id();
create trigger trg_tasks_set_org_id           before insert on public.tasks             for each row execute function public.set_org_id();
create trigger trg_dependencies_set_org_id    before insert on public.task_dependencies for each row execute function public.set_org_id();

-- =====================================================================
-- Trigger de auditoria: task_history
-- SECURITY DEFINER para poder inserir mesmo sem policy de INSERT.
-- =====================================================================
create or replace function public.log_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.task_history (organization_id, task_id, changed_by, field, old_value, new_value)
    values (old.organization_id, new.id, auth.uid(), 'status', old.status, new.status);
  end if;
  if new.priority is distinct from old.priority then
    insert into public.task_history (organization_id, task_id, changed_by, field, old_value, new_value)
    values (old.organization_id, new.id, auth.uid(), 'priority', old.priority, new.priority);
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    insert into public.task_history (organization_id, task_id, changed_by, field, old_value, new_value)
    values (old.organization_id, new.id, auth.uid(), 'assignee_id', old.assignee_id::text, new.assignee_id::text);
  end if;
  if new.reviewer_id is distinct from old.reviewer_id then
    insert into public.task_history (organization_id, task_id, changed_by, field, old_value, new_value)
    values (old.organization_id, new.id, auth.uid(), 'reviewer_id', old.reviewer_id::text, new.reviewer_id::text);
  end if;
  if new.planned_start_date is distinct from old.planned_start_date then
    insert into public.task_history (organization_id, task_id, changed_by, field, old_value, new_value)
    values (old.organization_id, new.id, auth.uid(), 'planned_start_date', old.planned_start_date::text, new.planned_start_date::text);
  end if;
  if new.planned_end_date is distinct from old.planned_end_date then
    insert into public.task_history (organization_id, task_id, changed_by, field, old_value, new_value)
    values (old.organization_id, new.id, auth.uid(), 'planned_end_date', old.planned_end_date::text, new.planned_end_date::text);
  end if;
  if new.estimated_hours is distinct from old.estimated_hours then
    insert into public.task_history (organization_id, task_id, changed_by, field, old_value, new_value)
    values (old.organization_id, new.id, auth.uid(), 'estimated_hours', old.estimated_hours::text, new.estimated_hours::text);
  end if;
  if new.progress is distinct from old.progress then
    insert into public.task_history (organization_id, task_id, changed_by, field, old_value, new_value)
    values (old.organization_id, new.id, auth.uid(), 'progress', old.progress::text, new.progress::text);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_log_change on public.tasks;
create trigger trg_tasks_log_change
  after update on public.tasks
  for each row execute function public.log_task_change();

-- =====================================================================
-- updated_at genérico
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_organizations_updated_at on public.organizations;
drop trigger if exists trg_profiles_updated_at      on public.profiles;
drop trigger if exists trg_projects_updated_at      on public.projects;
drop trigger if exists trg_modules_updated_at       on public.project_modules;
drop trigger if exists trg_wbs_updated_at           on public.wbs_items;
drop trigger if exists trg_phases_updated_at        on public.phases;
drop trigger if exists trg_milestones_updated_at    on public.milestones;
drop trigger if exists trg_tasks_updated_at         on public.tasks;

create trigger trg_organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger trg_profiles_updated_at      before update on public.profiles      for each row execute function public.set_updated_at();
create trigger trg_projects_updated_at      before update on public.projects      for each row execute function public.set_updated_at();
create trigger trg_modules_updated_at       before update on public.project_modules for each row execute function public.set_updated_at();
create trigger trg_wbs_updated_at           before update on public.wbs_items     for each row execute function public.set_updated_at();
create trigger trg_phases_updated_at        before update on public.phases        for each row execute function public.set_updated_at();
create trigger trg_milestones_updated_at    before update on public.milestones    for each row execute function public.set_updated_at();
create trigger trg_tasks_updated_at         before update on public.tasks         for each row execute function public.set_updated_at();

-- =====================================================================
-- RLS — habilitação + policies
-- Base de todas: organization_id = current_org_id()
-- =====================================================================

-- organizations
alter table public.organizations enable row level security;

create policy organizations_select_own on public.organizations
  for select using (id = public.current_org_id());

create policy organizations_insert_own on public.organizations
  for insert with check (auth.role() = 'authenticated');

create policy organizations_update_admin on public.organizations
  for update using (id = public.current_org_id() and public.current_role() = 'admin')
             with check (id = public.current_org_id() and public.current_role() = 'admin');

create policy organizations_delete_admin on public.organizations
  for delete using (id = public.current_org_id() and public.current_role() = 'admin');

-- profiles
alter table public.profiles enable row level security;

create policy profiles_select_org_or_self on public.profiles
  for select using (organization_id = public.current_org_id() or auth.uid() = id);

create policy profiles_insert_self on public.profiles
  for insert with check (auth.uid() = id);

create policy profiles_update_self_or_admin on public.profiles
  for update using (auth.uid() = id
                    or (organization_id = public.current_org_id() and public.current_role() = 'admin'))
             with check (auth.uid() = id
                    or (organization_id = public.current_org_id() and public.current_role() = 'admin'));

-- projects
alter table public.projects enable row level security;

create policy projects_select on public.projects
  for select using (organization_id = public.current_org_id());

create policy projects_insert on public.projects
  for insert with check (organization_id = public.current_org_id()
                         and public.current_role() in ('admin','manager'));

create policy projects_update on public.projects
  for update using (organization_id = public.current_org_id()
                    and public.current_role() in ('admin','manager'))
             with check (organization_id = public.current_org_id()
                         and public.current_role() in ('admin','manager'));

create policy projects_delete on public.projects
  for delete using (organization_id = public.current_org_id()
                    and public.current_role() = 'admin');

-- project_modules
alter table public.project_modules enable row level security;

create policy project_modules_select on public.project_modules
  for select using (organization_id = public.current_org_id());

create policy project_modules_insert on public.project_modules
  for insert with check (organization_id = public.current_org_id()
                         and public.current_role() in ('admin','manager'));

create policy project_modules_update on public.project_modules
  for update using (organization_id = public.current_org_id()
                    and public.current_role() in ('admin','manager'))
             with check (organization_id = public.current_org_id()
                         and public.current_role() in ('admin','manager'));

create policy project_modules_delete on public.project_modules
  for delete using (organization_id = public.current_org_id()
                    and public.current_role() in ('admin','manager'));

-- wbs_items
alter table public.wbs_items enable row level security;

create policy wbs_items_select on public.wbs_items
  for select using (organization_id = public.current_org_id());

create policy wbs_items_insert on public.wbs_items
  for insert with check (organization_id = public.current_org_id()
                         and public.current_role() in ('admin','manager'));

create policy wbs_items_update on public.wbs_items
  for update using (organization_id = public.current_org_id()
                    and public.current_role() in ('admin','manager'))
             with check (organization_id = public.current_org_id()
                         and public.current_role() in ('admin','manager'));

create policy wbs_items_delete on public.wbs_items
  for delete using (organization_id = public.current_org_id()
                    and public.current_role() in ('admin','manager'));

-- phases
alter table public.phases enable row level security;

create policy phases_select on public.phases
  for select using (organization_id = public.current_org_id());

create policy phases_insert on public.phases
  for insert with check (organization_id = public.current_org_id()
                         and public.current_role() in ('admin','manager'));

create policy phases_update on public.phases
  for update using (organization_id = public.current_org_id()
                    and public.current_role() in ('admin','manager'))
             with check (organization_id = public.current_org_id()
                         and public.current_role() in ('admin','manager'));

create policy phases_delete on public.phases
  for delete using (organization_id = public.current_org_id()
                    and public.current_role() in ('admin','manager'));

-- milestones
alter table public.milestones enable row level security;

create policy milestones_select on public.milestones
  for select using (organization_id = public.current_org_id());

create policy milestones_insert on public.milestones
  for insert with check (organization_id = public.current_org_id()
                         and public.current_role() in ('admin','manager'));

create policy milestones_update on public.milestones
  for update using (organization_id = public.current_org_id()
                    and public.current_role() in ('admin','manager'))
             with check (organization_id = public.current_org_id()
                         and public.current_role() in ('admin','manager'));

create policy milestones_delete on public.milestones
  for delete using (organization_id = public.current_org_id()
                    and public.current_role() in ('admin','manager'));

-- tasks
alter table public.tasks enable row level security;

create policy tasks_select on public.tasks
  for select using (organization_id = public.current_org_id());

create policy tasks_insert on public.tasks
  for insert with check (organization_id = public.current_org_id()
                         and public.current_role() in ('admin','manager','consultant'));

-- execução da própria tarefa (assignee) ou gestão (admin/manager)
create policy tasks_update on public.tasks
  for update using (organization_id = public.current_org_id()
                    and (public.current_role() in ('admin','manager')
                         or assignee_id = auth.uid()))
             with check (organization_id = public.current_org_id()
                         and (public.current_role() in ('admin','manager')
                              or assignee_id = auth.uid()));

create policy tasks_delete on public.tasks
  for delete using (organization_id = public.current_org_id()
                    and public.current_role() = 'admin');

-- task_dependencies
alter table public.task_dependencies enable row level security;

create policy task_dependencies_select on public.task_dependencies
  for select using (organization_id = public.current_org_id());

create policy task_dependencies_insert on public.task_dependencies
  for insert with check (organization_id = public.current_org_id()
                         and public.current_role() in ('admin','manager'));

create policy task_dependencies_update on public.task_dependencies
  for update using (organization_id = public.current_org_id()
                    and public.current_role() in ('admin','manager'))
             with check (organization_id = public.current_org_id()
                         and public.current_role() in ('admin','manager'));

create policy task_dependencies_delete on public.task_dependencies
  for delete using (organization_id = public.current_org_id()
                    and public.current_role() in ('admin','manager'));

-- task_history: apenas SELECT (escrita via trigger SECURITY DEFINER)
alter table public.task_history enable row level security;

create policy task_history_select on public.task_history
  for select using (organization_id = public.current_org_id());

commit;
