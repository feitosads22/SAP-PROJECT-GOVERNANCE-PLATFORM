-- =====================================================================
-- SEED de teste — Fase 1A — versão para Supabase REAL
-- Diferença para o 001_seed original: cria também as linhas em
-- auth.identities. Sem elas, o GoTrue recente não autentica o usuário
-- por e-mail/senha, mesmo com a linha em auth.users existindo.
-- Sem comandos de psql: pode colar direto no SQL Editor.
-- Idempotente: pode rodar mais de uma vez.
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
-- Usuários (auth.users) — o trigger handle_new_user cria os profiles
-- ---------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000001','authenticated','authenticated','admin.a@alpha.test',      crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Admin Alpha"}',      now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000002','authenticated','authenticated','manager.a@alpha.test',    crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Manager Alpha"}',    now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000003','authenticated','authenticated','consultant.a@alpha.test', crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Consultant Alpha"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000004','authenticated','authenticated','customer.a@alpha.test',   crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Customer Alpha"}',   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-0000-0000-0000-000000000001','authenticated','authenticated','manager.b@beta.test',     crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Manager Beta"}',     now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Identities — montadas dinamicamente porque o schema do auth muda
-- entre versões do Supabase (coluna provider_id nem sempre existe).
-- ---------------------------------------------------------------
do $$
declare
  u               record;
  has_provider_id boolean;
  has_id          boolean;
  cols            text;
  vals            text;
begin
  select exists (select 1 from information_schema.columns
                  where table_schema='auth' and table_name='identities'
                    and column_name='provider_id') into has_provider_id;
  select exists (select 1 from information_schema.columns
                  where table_schema='auth' and table_name='identities'
                    and column_name='id') into has_id;

  for u in select id, email from auth.users
            where id in ('aaaaaaaa-0000-0000-0000-000000000001',
                         'aaaaaaaa-0000-0000-0000-000000000002',
                         'aaaaaaaa-0000-0000-0000-000000000003',
                         'aaaaaaaa-0000-0000-0000-000000000004',
                         'bbbbbbbb-0000-0000-0000-000000000001')
  loop
    if exists (select 1 from auth.identities
                where user_id = u.id and provider = 'email') then
      continue;
    end if;

    cols := 'user_id, identity_data, provider, last_sign_in_at, created_at, updated_at';
    vals := '$1, $2, ''email'', now(), now(), now()';

    if has_provider_id then
      cols := 'provider_id, ' || cols;
      vals := '$3, ' || vals;
    end if;
    if has_id then
      cols := 'id, ' || cols;
      vals := 'gen_random_uuid(), ' || vals;
    end if;

    if has_provider_id then
      execute format('insert into auth.identities (%s) values (%s)', cols, vals)
        using u.id,
              jsonb_build_object('sub', u.id::text, 'email', u.email,
                                 'email_verified', true, 'phone_verified', false),
              u.id::text;
    else
      execute format('insert into auth.identities (%s) values (%s)', cols, vals)
        using u.id,
              jsonb_build_object('sub', u.id::text, 'email', u.email,
                                 'email_verified', true, 'phone_verified', false);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------
-- Profiles: organização + role
-- ---------------------------------------------------------------
update public.profiles set organization_id='11111111-1111-1111-1111-111111111111', role='admin',      full_name='Admin Alpha'      where id='aaaaaaaa-0000-0000-0000-000000000001';
update public.profiles set organization_id='11111111-1111-1111-1111-111111111111', role='manager',    full_name='Manager Alpha'    where id='aaaaaaaa-0000-0000-0000-000000000002';
update public.profiles set organization_id='11111111-1111-1111-1111-111111111111', role='consultant', full_name='Consultant Alpha' where id='aaaaaaaa-0000-0000-0000-000000000003';
update public.profiles set organization_id='11111111-1111-1111-1111-111111111111', role='customer',   full_name='Customer Alpha'   where id='aaaaaaaa-0000-0000-0000-000000000004';
update public.profiles set organization_id='22222222-2222-2222-2222-222222222222', role='manager',    full_name='Manager Beta'     where id='bbbbbbbb-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------
-- Projetos
-- ---------------------------------------------------------------
insert into public.projects (id, organization_id, name, code, description, status, priority, manager_id, sap_module, start_date, end_date)
values
  ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Projeto S/4HANA Alpha','ALPHA-S4','Implementação S/4HANA','active','high','aaaaaaaa-0000-0000-0000-000000000002','S/4HANA','2026-09-01','2027-03-31'),
  ('cccccccc-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','Projeto Upgrade Beta','BETA-UPG','Upgrade ECC para S/4HANA','draft','medium','bbbbbbbb-0000-0000-0000-000000000001','ECC','2026-10-01','2027-06-30')
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- Módulos, fases, milestone (idempotentes via unique de 0001b)
-- ---------------------------------------------------------------
insert into public.project_modules (organization_id, project_id, name, code, sap_module, sort_order)
select '11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001', m.nome, m.cod, 'S/4HANA', m.ord
from (values ('Financeiro','FI',1),('Controlling','CO',2),('Compras','MM',3)) as m(nome,cod,ord)
where not exists (select 1 from public.project_modules
                   where project_id='cccccccc-0000-0000-0000-000000000001' and code=m.cod);

insert into public.phases (organization_id, project_id, name, code, sort_order, status)
select '11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001', f.nome, f.cod, f.ord, f.st
from (values ('Preparação','PREP',1,'completed'),('Blueprint','BLU',2,'in_progress')) as f(nome,cod,ord,st)
where not exists (select 1 from public.phases
                   where project_id='cccccccc-0000-0000-0000-000000000001' and code=f.cod);

insert into public.milestones (organization_id, project_id, name, due_date, status)
select '11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001','Blueprint aprovado','2026-12-15','not_started'
where not exists (select 1 from public.milestones
                   where project_id='cccccccc-0000-0000-0000-000000000001'
                     and name='Blueprint aprovado');

-- ---------------------------------------------------------------
-- Tarefas (2 atribuídas ao consultor — o teste T7 espera exatamente 2)
-- ---------------------------------------------------------------
insert into public.tasks (organization_id, project_id, module_id, title, description, status, priority, assignee_id, reviewer_id, planned_start_date, planned_end_date, estimated_hours, progress, requires_evidence)
select '11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001',
       (select id from public.project_modules where project_id='cccccccc-0000-0000-0000-000000000001' and code='FI'),
       'Configurar plano de contas','Configuração do plano de contas no S/4HANA','in_progress','high',
       'aaaaaaaa-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000002',
       '2026-09-15','2026-10-15',40,50,true
where not exists (select 1 from public.tasks
                   where project_id='cccccccc-0000-0000-0000-000000000001'
                     and title='Configurar plano de contas');

insert into public.tasks (organization_id, project_id, module_id, title, description, status, priority, assignee_id, reviewer_id, planned_start_date, planned_end_date, estimated_hours, progress, requires_evidence)
select '11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001',
       (select id from public.project_modules where project_id='cccccccc-0000-0000-0000-000000000001' and code='MM'),
       'Definir grupo de compras','Definição de grupos de compras','todo','medium',
       'aaaaaaaa-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000002',
       '2026-10-01','2026-11-01',20,0,false
where not exists (select 1 from public.tasks
                   where project_id='cccccccc-0000-0000-0000-000000000001'
                     and title='Definir grupo de compras');

-- ---------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------
select
  (select count(*) from public.organizations)                              as orgs,
  (select count(*) from public.profiles where organization_id is not null) as profiles_vinculados,
  (select count(*) from auth.identities)                                   as identities,
  (select count(*) from public.projects)                                   as projetos,
  (select count(*) from public.project_modules)                            as modulos,
  (select count(*) from public.tasks)                                      as tarefas;
