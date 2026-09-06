-- =====================================================================
-- ROLLBACK de 0001b_hotfix_tenancy_privilege.sql
-- ATENÇÃO: reverter reabre o escalonamento de privilégio no profiles.
-- Não apaga dados.
-- =====================================================================
begin;

drop trigger if exists trg_profiles_enforce_privileges on public.profiles;
drop function if exists public.enforce_profile_privileges();
drop function if exists public.create_organization(text, text, text);

drop policy if exists organizations_insert_bootstrap on public.organizations;
create policy organizations_insert_own on public.organizations
  for insert with check (auth.role() = 'authenticated');

drop index if exists public.project_modules_project_code_uidx;
drop index if exists public.phases_project_code_uidx;
drop index if exists public.wbs_items_project_code_uidx;

alter table public.task_dependencies
  drop constraint if exists task_dependencies_no_self;

commit;
