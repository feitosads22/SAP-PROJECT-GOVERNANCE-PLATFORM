-- =====================================================================
-- Massa de dados fake — Org Alpha (para o sistema ficar apresentável)
-- Idempotente na maior parte (usa ON CONFLICT / checagens), mas os
-- INSERTs de tasks/timesheets/comentários rodam sempre que executado —
-- rode este script UMA VEZ. Senha de todo usuário novo: teste123
-- =====================================================================

-- ---------------------------------------------------------------
-- 0. Limpeza de resíduos de teste manual (criados durante os testes das fases)
-- ---------------------------------------------------------------
delete from public.projects where code = 'RTHRTH';
update public.resource_allocations set allocated_hours = 120 where allocated_hours > 1000;

-- ---------------------------------------------------------------
-- 1. Três consultores novos (auth.users + identities, mesmo padrão do seed 001)
-- ---------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000005','authenticated','authenticated','consultant2.a@alpha.test', crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Beatriz Souza"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000006','authenticated','authenticated','consultant3.a@alpha.test', crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Rafael Lima"}',   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000007','authenticated','authenticated','consultant4.a@alpha.test', crypt('teste123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{"full_name":"Camila Torres"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

do $$
declare
  u record; has_provider_id boolean; has_id boolean; cols text; vals text;
begin
  select exists (select 1 from information_schema.columns where table_schema='auth' and table_name='identities' and column_name='provider_id') into has_provider_id;
  select exists (select 1 from information_schema.columns where table_schema='auth' and table_name='identities' and column_name='id') into has_id;

  for u in select id, email from auth.users
            where id in ('aaaaaaaa-0000-0000-0000-000000000005','aaaaaaaa-0000-0000-0000-000000000006','aaaaaaaa-0000-0000-0000-000000000007')
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
update public.profiles set organization_id='11111111-1111-1111-1111-111111111111', role='consultant'
 where id in ('aaaaaaaa-0000-0000-0000-000000000005','aaaaaaaa-0000-0000-0000-000000000006','aaaaaaaa-0000-0000-0000-000000000007');

-- ---------------------------------------------------------------
-- 2. Resources (Consultant Alpha já existe; adiciona os 3 novos)
-- ---------------------------------------------------------------
insert into public.resources (organization_id, profile_id, sap_modules, seniority, hourly_rate, weekly_capacity_hours, is_active)
values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000005', array['FI','CO'], 'pleno', 180, 40, true),
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000006', array['MM','SD'], 'senior', 240, 40, true),
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000007', array['BW/BO'],   'junior', 120, 30, true)
on conflict (profile_id) do nothing;

-- ---------------------------------------------------------------
-- 3. Alocações a projetos (todos os recursos ativos da Org Alpha)
-- ---------------------------------------------------------------
insert into public.resource_allocations (organization_id, resource_id, project_id, role_in_project, allocated_hours, start_date, end_date)
select '11111111-1111-1111-1111-111111111111', r.id, p.id, 'Consultor', (80 + (random()*80)::int), current_date - 30, current_date + 60
from public.resources r
cross join lateral (
  select id from public.projects where organization_id='11111111-1111-1111-1111-111111111111' order by random() limit 2
) p
where r.organization_id='11111111-1111-1111-1111-111111111111'
  and not exists (select 1 from public.resource_allocations ra where ra.resource_id=r.id and ra.project_id=p.id);

-- ---------------------------------------------------------------
-- 4. Timesheets — últimas 4 semanas, por recurso, dias úteis, status variado
-- ---------------------------------------------------------------
do $$
declare
  r record; d date; alloc record; st text; approver uuid;
begin
  select id into approver from public.profiles where email='manager.a@alpha.test';
  for r in select res.id as resource_id, res.organization_id from public.resources res
            where res.organization_id='11111111-1111-1111-1111-111111111111'
  loop
    for alloc in select project_id from public.resource_allocations where resource_id = r.resource_id loop
      for d in select generate_series(current_date - 27, current_date, interval '1 day')::date loop
        if extract(dow from d) in (0,6) then continue; end if;
        if random() < 0.35 then continue; end if; -- nem todo dia tem apontamento
        st := case when random() < 0.7 then 'approved' when random() < 0.85 then 'submitted' else 'rejected' end;
        insert into public.timesheets (organization_id, resource_id, project_id, date, hours, description, approved_by, approved_at, rejected_by, rejected_at, rejection_reason)
        values (
          r.organization_id, r.resource_id, alloc.project_id, d, (4 + (random()*4)::int),
          'Atividades do dia — desenvolvimento e testes',
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
-- 5. Tarefas extras por projeto — algumas vencendo em 3 dias, outras atrasadas
--    (para exercitar as notificações automáticas da Fase 15)
-- ---------------------------------------------------------------
do $$
declare
  p record; consultores uuid[]; i int := 0;
  titulos text[] := array[
    'Configurar customizing inicial','Levantamento de requisitos','Mapear processo AS-IS',
    'Desenhar processo TO-BE','Configurar tabela de customizing','Testes unitários de configuração',
    'Homologação com key user','Ajustar fluxo de aprovação','Documentar processo',
    'Treinamento de usuários finais','Corrigir apontamento de erro','Revisão de autorletização'];
begin
  select array_agg(id) into consultores from public.resources where organization_id='11111111-1111-1111-1111-111111111111';
  for p in select id from public.projects where organization_id='11111111-1111-1111-1111-111111111111' loop
    for i in 1..6 loop
      insert into public.tasks (organization_id, project_id, title, status, priority, assignee_id, due_date, estimated_hours, progress, sap_activate_phase)
      select '11111111-1111-1111-1111-111111111111', p.id,
        titulos[1 + (i % array_length(titulos,1))],
        (array['todo','in_progress','blocked','validation','completed'])[1 + floor(random()*5)::int],
        (array['low','medium','high','critical'])[1 + floor(random()*4)::int],
        pr.profile_id,
        case
          when i = 1 then current_date + 3   -- vence em 3 dias -> dispara notificação
          when i = 2 then current_date - 4   -- atrasada -> dispara notificação
          else current_date + (floor(random()*30)::int - 10)
        end,
        (8 + (random()*32)::int), (random()*100)::int,
        (array['Preparar','Explorar','Realizar','Implementar'])[1 + floor(random()*4)::int]
      from public.resources pr where pr.organization_id='11111111-1111-1111-1111-111111111111' order by random() limit 1;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------
-- 6. Milestones próximos (3 dias) — dispara notificação de marco
-- ---------------------------------------------------------------
insert into public.milestones (organization_id, project_id, name, due_date, status)
select '11111111-1111-1111-1111-111111111111', id, 'Go-live piloto', current_date + 3, 'in_progress'
from public.projects where organization_id='11111111-1111-1111-1111-111111111111'
on conflict do nothing;

-- ---------------------------------------------------------------
-- 7. Riscos, issues e change requests extras
-- ---------------------------------------------------------------
insert into public.project_risks (organization_id, project_id, title, probability, impact, status, category)
select '11111111-1111-1111-1111-111111111111', id, 'Atraso na entrega de dados legados', 'high','high','identified','tecnico'
from public.projects where organization_id='11111111-1111-1111-1111-111111111111';

insert into public.project_issues (organization_id, project_id, title, priority, status)
select '11111111-1111-1111-1111-111111111111', id, 'Ambiente de testes instável', 'high','open'
from public.projects where organization_id='11111111-1111-1111-1111-111111111111';

insert into public.change_requests (organization_id, project_id, number, title, justification, additional_hours, additional_cost, schedule_impact_days, status, requested_by)
select '11111111-1111-1111-1111-111111111111', id,
  (select coalesce(max(number),0)+1 from public.change_requests cr2 where cr2.project_id = p.id),
  'Incluir módulo adicional de relatórios', 'Cliente solicitou relatório gerencial extra', 24, 6000, 5, 'submitted',
  (select id from public.profiles where email='manager.a@alpha.test')
from public.projects p where organization_id='11111111-1111-1111-1111-111111111111';

-- ---------------------------------------------------------------
-- 8. Comentários em tarefas (com @menção pra testar notificação)
-- ---------------------------------------------------------------
insert into public.task_comments (organization_id, task_id, author_id, body)
select '11111111-1111-1111-1111-111111111111', t.id,
  (select id from public.profiles where email='manager.a@alpha.test'),
  'Pessoal, priorizar essa atividade essa semana. @Consultant Alpha pode assumir?'
from public.tasks t
where t.organization_id='11111111-1111-1111-1111-111111111111'
order by random() limit 5;

select 'Massa de dados fake inserida com sucesso' as resultado;
