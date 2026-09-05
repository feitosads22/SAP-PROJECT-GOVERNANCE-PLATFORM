-- =====================================================================
-- Seed de dados de teste — Fase 1A
-- Aplicar APÓS a migration 0001.
-- Cria 2 organizações (A e B) + usuários de teste com roles distintas,
-- projetos, módulos, fases, milestone e tarefas.
-- UUIDs fixos para os testes de RLS referenciarem.
-- Senha de todos os usuários de teste: teste123
-- =====================================================================

-- ---------------------------------------------------------------
-- Organizações
-- ---------------------------------------------------------------
insert into public.organizations (id, name, slug, sap_client_number)
values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'org-alpha', '100'),
  ('22222222-2222-2222-2222-222222222222', 'Org Beta',  'org-beta',  '200')
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Usuários de teste (auth.users) — trigger cria os profiles 'pending'
-- ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin.a@alpha.test',      crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin Alpha"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'manager.a@alpha.test',   crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Manager Alpha"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'consultant.a@alpha.test', crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Consultant Alpha"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'customer.a@alpha.test',  crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Customer Alpha"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'manager.b@beta.test',    crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Manager Beta"}', now(), now())
on conflict do nothing;

-- ---------------------------------------------------------------
-- Profiles: vincula organização e role
-- ---------------------------------------------------------------
update public.profiles
set organization_id = '11111111-1111-1111-1111-111111111111', role = 'admin',      full_name = 'Admin Alpha'
where id = 'aaaaaaaa-0000-0000-0000-000000000001';

update public.profiles
set organization_id = '11111111-1111-1111-1111-111111111111', role = 'manager',    full_name = 'Manager Alpha'
where id = 'aaaaaaaa-0000-0000-0000-000000000002';

update public.profiles
set organization_id = '11111111-1111-1111-1111-111111111111', role = 'consultant', full_name = 'Consultant Alpha'
where id = 'aaaaaaaa-0000-0000-0000-000000000003';

update public.profiles
set organization_id = '11111111-1111-1111-1111-111111111111', role = 'customer',   full_name = 'Customer Alpha'
where id = 'aaaaaaaa-0000-0000-0000-000000000004';

update public.profiles
set organization_id = '22222222-2222-2222-2222-222222222222', role = 'manager',    full_name = 'Manager Beta'
where id = 'bbbbbbbb-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------
-- Projetos
-- ---------------------------------------------------------------
insert into public.projects (id, organization_id, name, code, description, status, priority, manager_id, sap_module, start_date, end_date)
values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Projeto S/4HANA Alpha', 'ALPHA-S4', 'Implementação S/4HANA', 'active', 'high', 'aaaaaaaa-0000-0000-0000-000000000002', 'S/4HANA', '2026-09-01', '2027-03-31'),
  ('cccccccc-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Projeto Upgrade Beta',   'BETA-UPG', 'Upgrade ECC para S/4HANA', 'draft', 'medium', 'bbbbbbbb-0000-0000-0000-000000000001', 'ECC', '2026-10-01', '2027-06-30')
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Módulos SAP do projeto Alpha
-- ---------------------------------------------------------------
insert into public.project_modules (organization_id, project_id, name, code, sap_module, sort_order)
values
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'Financeiro',   'FI', 'S/4HANA', 1),
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'Controlling',  'CO', 'S/4HANA', 2),
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'Compras',      'MM', 'S/4HANA', 3);

-- ---------------------------------------------------------------
-- Fases e milestone do projeto Alpha
-- ---------------------------------------------------------------
insert into public.phases (organization_id, project_id, name, code, sort_order, status)
values
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'Preparação', 'PREP', 1, 'completed'),
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'Blueprint',  'BLU',  2, 'in_progress');

insert into public.milestones (organization_id, project_id, name, due_date, status)
values
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'Blueprint aprovado', '2026-12-15', 'not_started');

-- ---------------------------------------------------------------
-- Tarefas do projeto Alpha
-- ---------------------------------------------------------------
insert into public.tasks (organization_id, project_id, module_id, title, description, status, priority, assignee_id, reviewer_id, planned_start_date, planned_end_date, estimated_hours, progress, requires_evidence)
values
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001',
   (select id from public.project_modules where project_id = 'cccccccc-0000-0000-0000-000000000001' and code = 'FI'),
   'Configurar plano de contas', 'Configuração do plano de contas no S/4HANA', 'in_progress', 'high',
   'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002',
   '2026-09-15', '2026-10-15', 40, 50, true),
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001',
   (select id from public.project_modules where project_id = 'cccccccc-0000-0000-0000-000000000001' and code = 'MM'),
   'Definir grupo de compras', 'Definição de grupos de compras', 'todo', 'medium',
   'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002',
   '2026-10-01', '2026-11-01', 20, 0, false);
