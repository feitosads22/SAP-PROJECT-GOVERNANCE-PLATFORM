-- =====================================================================
-- Massa de dados fake — Prisma Sistemas Empresariais Ltda. (org Beta)
-- Espelha o 002_demo_data.sql (que só populou a Vantus/Org Alpha).
-- A Prisma até aqui só tinha 1 manager e 1 projeto em 'draft'.
-- Idempotente na maior parte; rode UMA VEZ. Senha de todo usuário novo: teste123
-- =====================================================================

-- ---------------------------------------------------------------
-- 0. Ativa o projeto que já existia (estava em 'draft')
-- ---------------------------------------------------------------
update public.projects
set status = 'active'
where code = 'BETA-UPG';

-- ---------------------------------------------------------------
-- 1. Admin + 2 consultores novos (auth.users + identities)
-- ---------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-0000-0000-0000-000000000002','authenticated','authenticated','admin.b@beta.test',       crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Patricia Almeida"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-0000-0000-0000-000000000003','authenticated','authenticated','consultant1.b@beta.test', crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Thiago Nogueira"}',  now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-0000-0000-0000-000000000004','authenticated','authenticated','consultant2.b@beta.test', crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Larissa Martins"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-0000-0000-0000-000000000005','authenticated','authenticated','consultant3.b@beta.test', crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Eduardo Ramos"}',    now(), now(), '', '', '', '')
on conflict (id) do nothing;

do $$
declare
  u record; has_provider_id boolean; has_id boolean; cols text; vals text;
begin
  select exists (select 1 from information_schema.columns where table_schema='auth' and table_name='identities' and column_name='provider_id') into has_provider_id;
  select exists (select 1 from information_schema.columns where table_schema='auth' and table_name='identities' and column_name='id') into has_id;

  for u in select id, email from auth.users
            where id in ('bbbbbbbb-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000005')
  loop
    if exists (select 1 from auth.identities where user_id = u.id and provider = 'email') then continue; end if;
    cols := 'user_id, identity_data, provider, last_sign_in_at, created_at, updated_at';
    vals := '$1, $2, ''email'', now(), now(), now()';
    if has_provider_id then cols := 'provider_id, ' || cols; vals := '$3, ' || vals; end if;
    if has_id then cols := 'id, ' || cols; vals := 'gen_random_uuid(), ' || vals; end if;
    if has_provider_id then
      execute format('insert into auth.identities (%s) values (%s)', cols, vals) using u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), u.id::text;
    else
      execute format('insert into auth.identities (%s) values (%s)', cols, vals) using u.id, jsonb_build_object('sub', u.id::text, 'email', u.email);
    end if;
  end loop;
end $$;

-- profiles são criados pelo trigger handle_new_user; ajusta org/role
update public.profiles set organization_id='22222222-2222-2222-2222-222222222222', role='admin',      full_name='Patricia Almeida' where id='bbbbbbbb-0000-0000-0000-000000000002';
update public.profiles set organization_id='22222222-2222-2222-2222-222222222222', role='consultant', full_name='Thiago Nogueira'  where id='bbbbbbbb-0000-0000-0000-000000000003';
update public.profiles set organization_id='22222222-2222-2222-2222-222222222222', role='consultant', full_name='Larissa Martins'  where id='bbbbbbbb-0000-0000-0000-000000000004';
update public.profiles set organization_id='22222222-2222-2222-2222-222222222222', role='consultant', full_name='Eduardo Ramos'    where id='bbbbbbbb-0000-0000-0000-000000000005';

-- ---------------------------------------------------------------
-- 2. Dois projetos novos, ativos, com clientes finais fictícios
-- ---------------------------------------------------------------
insert into public.projects (id, organization_id, name, code, description, status, priority, manager_id, sap_module, start_date, end_date)
values
  ('dddddddd-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','SuccessFactors — Rede Hospitalar Vitalis',       'BETA-SF',   'Implementação SAP SuccessFactors','active','high',   'bbbbbbbb-0000-0000-0000-000000000002','SuccessFactors','2026-08-01','2027-02-28'),
  ('dddddddd-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','S/4HANA — Têxtil Ouro Fino Ltda.',                'BETA-S4',   'Implementação S/4HANA Public Cloud','active','critical','bbbbbbbb-0000-0000-0000-000000000002','S/4HANA','2026-07-15','2027-05-31')
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- 3. Módulos e fases para os 3 projetos da Prisma
-- ---------------------------------------------------------------
insert into public.project_modules (organization_id, project_id, name, code, sap_module, sort_order)
select '22222222-2222-2222-2222-222222222222', p.id, m.nome, m.cod, p.sap_module, m.ord
from public.projects p
cross join lateral (
  values ('Financeiro','FI',1), ('Vendas','SD',2), ('Materiais','MM',3)
) as m(nome, cod, ord)
where p.organization_id = '22222222-2222-2222-2222-222222222222'
  and not exists (select 1 from public.project_modules pm where pm.project_id = p.id and pm.code = m.cod);

insert into public.phases (organization_id, project_id, name, code, sort_order, status)
select '22222222-2222-2222-2222-222222222222', p.id, f.nome, f.cod, f.ord, f.st
from public.projects p
cross join lateral (
  values ('Preparação','PREP',1,'completed'), ('Exploração','EXPL',2,'in_progress'), ('Realização','REAL',3,'not_started')
) as f(nome, cod, ord, st)
where p.organization_id = '22222222-2222-2222-2222-222222222222'
  and not exists (select 1 from public.phases ph where ph.project_id = p.id and ph.code = f.cod);

-- ---------------------------------------------------------------
-- 4. Resources (admin também vira recurso alocável, como PM)
-- ---------------------------------------------------------------
insert into public.resources (organization_id, profile_id, sap_modules, seniority, hourly_rate, weekly_capacity_hours, is_active)
values
  ('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000002', array['PM'],       'senior', 260, 40, true),
  ('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000003', array['SD','MM'],  'pleno',  190, 40, true),
  ('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000004', array['FI'],       'senior', 230, 40, true),
  ('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000005', array['BASIS'],    'junior', 130, 30, true)
on conflict (profile_id) do nothing;

-- ---------------------------------------------------------------
-- 5. Alocações a projetos
-- ---------------------------------------------------------------
insert into public.resource_allocations (organization_id, resource_id, project_id, role_in_project, allocated_hours, start_date, end_date)
select '22222222-2222-2222-2222-222222222222', r.id, p.id, 'Consultor', (60 + (random()*100)::int), current_date - 30, current_date + 90
from public.resources r
cross join lateral (
  select id from public.projects where organization_id='22222222-2222-2222-2222-222222222222' order by random() limit 2
) p
where r.organization_id='22222222-2222-2222-2222-222222222222'
  and not exists (select 1 from public.resource_allocations ra where ra.resource_id=r.id and ra.project_id=p.id);

-- ---------------------------------------------------------------
-- 6. Timesheets — últimas 4 semanas, status variado
-- ---------------------------------------------------------------
do $$
declare
  r record; d date; alloc record; st text; approver uuid;
begin
  select id into approver from public.profiles where email='admin.b@beta.test';
  for r in select res.id as resource_id, res.organization_id from public.resources res
            where res.organization_id='22222222-2222-2222-2222-222222222222'
  loop
    for alloc in select project_id from public.resource_allocations where resource_id = r.resource_id loop
      for d in select generate_series(current_date - 27, current_date, interval '1 day')::date loop
        if extract(dow from d) in (0,6) then continue; end if;
        if random() < 0.35 then continue; end if;
        st := case when random() < 0.7 then 'approved' when random() < 0.85 then 'submitted' else 'rejected' end;
        insert into public.timesheets (organization_id, resource_id, project_id, date, hours, description, approved_by, approved_at, rejected_by, rejected_at, rejection_reason)
        values (
          r.organization_id, r.resource_id, alloc.project_id, d, (4 + (random()*4)::int),
          'Atividades do dia — configuração e testes',
          case when st='approved' then approver else null end,
          case when st='approved' then d::timestamptz + interval '1 day' else null end,
          case when st='rejected' then approver else null end,
          case when st='rejected' then d::timestamptz + interval '1 day' else null end,
          case when st='rejected' then 'Horas acima do estimado, revisar' else null end
        );
      end loop;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------
-- 7. Tarefas por projeto (usando module_id real, não código texto)
-- ---------------------------------------------------------------
do $$
declare
  p record; i int;
  titulos text[] := array[
    'Configurar customizing inicial','Levantamento de requisitos','Mapear processo AS-IS',
    'Desenhar processo TO-BE','Configurar tabela de customizing','Testes unitários de configuração',
    'Homologação com key user','Ajustar fluxo de aprovação','Documentar processo',
    'Treinamento de usuários finais','Corrigir apontamento de erro','Revisão de autorização'];
begin
  for p in select id from public.projects where organization_id='22222222-2222-2222-2222-222222222222' loop
    for i in 1..6 loop
      insert into public.tasks (organization_id, project_id, module_id, title, status, priority, assignee_id, due_date, estimated_hours, progress, sap_activate_phase)
      select '22222222-2222-2222-2222-222222222222', p.id,
        (select id from public.project_modules where project_id = p.id order by sort_order limit 1),
        titulos[1 + (i % array_length(titulos,1))],
        (array['todo','in_progress','blocked','validation','completed'])[1 + floor(random()*5)::int],
        (array['low','medium','high','critical'])[1 + floor(random()*4)::int],
        pr.profile_id,
        case
          when i = 1 then current_date + 3
          when i = 2 then current_date - 4
          else current_date + (floor(random()*30)::int - 10)
        end,
        (8 + (random()*32)::int), (random()*100)::int,
        (array['Preparar','Explorar','Realizar','Implementar'])[1 + floor(random()*4)::int]
      from public.resources pr where pr.organization_id='22222222-2222-2222-2222-222222222222' order by random() limit 1;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------
-- 8. Milestone próximo (dispara notificação)
-- ---------------------------------------------------------------
insert into public.milestones (organization_id, project_id, name, due_date, status)
select '22222222-2222-2222-2222-222222222222', id, 'Go-live piloto', current_date + 3, 'in_progress'
from public.projects where organization_id='22222222-2222-2222-2222-222222222222'
on conflict do nothing;

-- ---------------------------------------------------------------
-- 9. Riscos, issues e change requests
-- ---------------------------------------------------------------
insert into public.project_risks (organization_id, project_id, title, probability, impact, status, category)
select '22222222-2222-2222-2222-222222222222', id, 'Dependência de integração com sistema legado', 'medium','high','identified','technical'
from public.projects where organization_id='22222222-2222-2222-2222-222222222222';

insert into public.project_issues (organization_id, project_id, title, priority, status)
select '22222222-2222-2222-2222-222222222222', id, 'Divergência no cadastro de materiais', 'medium','open'
from public.projects where organization_id='22222222-2222-2222-2222-222222222222';

insert into public.change_requests (organization_id, project_id, number, title, justification, additional_hours, additional_cost, schedule_impact_days, status, requested_by)
select '22222222-2222-2222-2222-222222222222', id,
  (select coalesce(max(number),0)+1 from public.change_requests cr2 where cr2.project_id = p.id),
  'Incluir relatório fiscal adicional', 'Cliente solicitou relatório extra para compliance', 16, 4000, 3, 'submitted',
  (select id from public.profiles where email='admin.b@beta.test')
from public.projects p where organization_id='22222222-2222-2222-2222-222222222222';

-- ---------------------------------------------------------------
-- 10. Comentários em tarefas (com @menção)
-- ---------------------------------------------------------------
insert into public.task_comments (organization_id, task_id, author_id, body)
select '22222222-2222-2222-2222-222222222222', t.id,
  (select id from public.profiles where email='admin.b@beta.test'),
  'Pessoal, priorizar essa atividade essa semana. @Thiago Nogueira pode assumir?'
from public.tasks t
where t.organization_id='22222222-2222-2222-2222-222222222222'
order by random() limit 5;

select 'Massa de dados fake da Prisma inserida com sucesso' as resultado;
