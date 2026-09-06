-- =====================================================================
-- Fase 1A — HOTFIX de segurança
-- Arquivo : 0001b_hotfix_tenancy_privilege.sql
-- Aplicar : APÓS 0001_foundation_auth_orgs_projects.sql
-- Motivo  : a migration 0001 permite que qualquer usuário altere o
--           próprio profile, inclusive role e organization_id.
--           Isso quebra o critério de conclusão da Fase 1A
--           ("usuário da org A não vê nada da org B").
-- Rollback: 0001b_hotfix_tenancy_privilege_down.sql
-- =====================================================================

begin;
set check_function_bodies = off;

-- ---------------------------------------------------------------
-- 1. Congelar role e organization_id no próprio profile.
--    Só admin da MESMA organização muda esses campos.
--    Operações sem usuário autenticado (seed/admin via postgres ou
--    service_role) continuam livres.
-- ---------------------------------------------------------------
create or replace function public.enforce_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor        uuid := auth.uid();
  actor_role   text;
  actor_org    uuid;
begin
  if actor is null then
    return new;                       -- postgres / service_role
  end if;

  -- Bootstrap: liberado apenas dentro de public.create_organization(),
  -- que grava o id recém-criado num setting LOCAL da transação.
  -- O usuário precisa estar 'pending' e sem organização.
  if old.organization_id is null
     and old.role = 'pending'
     and new.role = 'admin'
     and new.organization_id is not null
     and new.organization_id::text = nullif(current_setting('app.bootstrap_org', true), '') then
    return new;
  end if;

  select p.role, p.organization_id into actor_role, actor_org
  from public.profiles p where p.id = actor;

  -- admin só administra dentro da própria organização
  if actor_role = 'admin'
     and actor_org is not null
     and old.organization_id is not distinct from actor_org
     and new.organization_id is not distinct from actor_org then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'PRIV_DENIED: alteracao de role exige admin da propria organizacao'
      using errcode = '42501';
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'PRIV_DENIED: alteracao de organization_id exige admin da propria organizacao'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_enforce_privileges on public.profiles;
create trigger trg_profiles_enforce_privileges
  before update on public.profiles
  for each row execute function public.enforce_profile_privileges();

-- ---------------------------------------------------------------
-- 2. Onboarding: criar organização deixa de ser INSERT livre.
--    Passa a existir um único caminho, transacional, que cria a org
--    e promove o criador a admin dela. Quem já tem org não pode criar.
-- ---------------------------------------------------------------
drop policy if exists organizations_insert_own       on public.organizations;
drop policy if exists organizations_insert_bootstrap on public.organizations;

create policy organizations_insert_bootstrap on public.organizations
  for insert with check (
    auth.uid() is not null
    and public.current_org_id() is null
  );

create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_sap_client_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org   uuid;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if public.current_org_id() is not null then
    raise exception 'ALREADY_IN_ORG: usuario ja pertence a uma organizacao'
      using errcode = '42501';
  end if;

  insert into public.organizations (name, slug, sap_client_number)
  values (p_name, p_slug, p_sap_client_number)
  returning id into v_org;

  perform set_config('app.bootstrap_org', v_org::text, true);

  update public.profiles
     set organization_id = v_org,
         role            = 'admin'
   where id = v_actor;

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;

-- ---------------------------------------------------------------
-- 3. Unicidade de códigos por projeto.
--    O seed e o frontend selecionam módulo/fase por (project_id, code);
--    sem unique isso retorna linha arbitrária ou quebra.
-- ---------------------------------------------------------------
create unique index if not exists project_modules_project_code_uidx
  on public.project_modules (project_id, code);

create unique index if not exists phases_project_code_uidx
  on public.phases (project_id, code);

create unique index if not exists wbs_items_project_code_uidx
  on public.wbs_items (project_id, code);

-- ---------------------------------------------------------------
-- 4. Dependência de tarefa não pode apontar para ela mesma.
-- ---------------------------------------------------------------
alter table public.task_dependencies
  drop constraint if exists task_dependencies_no_self;
alter table public.task_dependencies
  add constraint task_dependencies_no_self check (task_id <> depends_on_task_id);

-- ---------------------------------------------------------------
-- 5. Grants explícitos (não depender de default privileges do projeto).
-- ---------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.organizations, public.profiles, public.projects,
  public.project_modules, public.wbs_items, public.phases,
  public.milestones, public.tasks, public.task_dependencies
to authenticated;
grant select on public.task_history to authenticated;
revoke all on public.task_history from anon;

commit;
