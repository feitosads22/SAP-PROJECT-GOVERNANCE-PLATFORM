-- Fase 19 — Papel "platform_admin" (Delivery Manager / dono do SaaS)
-- Enxerga e gerencia TODAS as organizações (clientes), não só a própria.
--
-- Abordagem: só ADITIVO. Nenhuma policy existente é alterada — cada
-- tabela ganha uma policy NOVA que libera acesso quando is_platform_admin()
-- é verdadeiro. Como o Postgres combina policies permissivas com OR, isso
-- amplia acesso sem arriscar quebrar (ou reabrir) as regras multi-tenant
-- já validadas na suíte de RLS.

begin;

-- 1. Novo valor de role
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('pending','admin','manager','consultant','customer','platform_admin'));

-- 2. Helper — true só para quem tem role='platform_admin'
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'platform_admin'
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- 3. Policies aditivas — visão e gestão cross-tenant
drop policy if exists platform_admin_orgs_select on public.organizations;
create policy platform_admin_orgs_select on public.organizations for select
  using (public.is_platform_admin());

drop policy if exists platform_admin_orgs_insert on public.organizations;
create policy platform_admin_orgs_insert on public.organizations for insert
  with check (public.is_platform_admin());

drop policy if exists platform_admin_orgs_update on public.organizations;
create policy platform_admin_orgs_update on public.organizations for update
  using (public.is_platform_admin());

drop policy if exists platform_admin_profiles_select on public.profiles;
create policy platform_admin_profiles_select on public.profiles for select
  using (public.is_platform_admin());

drop policy if exists platform_admin_projects_select on public.projects;
create policy platform_admin_projects_select on public.projects for select
  using (public.is_platform_admin());

drop policy if exists platform_admin_budgets_select on public.project_budgets;
create policy platform_admin_budgets_select on public.project_budgets for select
  using (public.is_platform_admin());

drop policy if exists platform_admin_costs_select on public.project_costs;
create policy platform_admin_costs_select on public.project_costs for select
  using (public.is_platform_admin());

drop policy if exists platform_admin_resources_select on public.resources;
create policy platform_admin_resources_select on public.resources for select
  using (public.is_platform_admin());

commit;
