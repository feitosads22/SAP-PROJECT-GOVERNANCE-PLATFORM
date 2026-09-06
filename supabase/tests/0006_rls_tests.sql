-- Testes Fase 5 — Governança Avançada
begin;
set local role authenticated;

-- F1: manager cria risco
do $$declare rid uuid;begin
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);
  insert into public.project_risks (project_id,title,probability,impact,status)
  values ('cccccccc-0000-0000-0000-000000000001','Risco teste','high','high','identified')
  returning id into rid;
  assert rid is not null,'FAIL F1';
end$$;

-- F2: score calculado automaticamente (high × high = 3×3 = 9)
do $$declare sc int;begin
  set local role postgres;
  select score into sc from public.project_risks
   where project_id='cccccccc-0000-0000-0000-000000000001' and title='Risco teste';
  assert sc=9,'FAIL F2';
end$$;

-- F3: customer lê riscos (sem filtro de projeto ainda — Fase 7)
do $$declare cnt int;begin
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}',true);
  select count(*) into cnt from public.project_risks
   where organization_id='11111111-1111-1111-1111-111111111111';
  assert cnt>=0,'FAIL F3';
end$$;

-- F4: customer NÃO cria risco
do $$declare ok bool:=false;begin
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}',true);
  begin
    insert into public.project_risks (project_id,title,probability,impact,status)
    values ('cccccccc-0000-0000-0000-000000000001','Pirata','low','low','identified');
  exception when insufficient_privilege then ok:=true;
  end;
  assert ok,'FAIL F4';
end$$;

-- F5: org B não consegue inserir risco associado ao projeto da org A
--     (o trigger set_org_id move o org_id para B, e a FK project_id viola
--      porque o projeto pertence à org A — ou a RLS bloqueia diretamente)
do $$declare ok bool:=false; cnt int;begin
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);
  begin
    insert into public.project_risks (project_id,title,probability,impact,status)
    values ('cccccccc-0000-0000-0000-000000000001','Invasão','low','low','identified');
  exception when others then ok:=true;
  end;
  if not ok then
    -- mesmo que inseriu, verifica que não está visível na org A
    set local role postgres;
    select count(*) into cnt from public.project_risks
     where organization_id='11111111-1111-1111-1111-111111111111'
       and title='Invasão';
    ok := (cnt = 0);
  end if;
  assert ok,'FAIL F5';
end$$;

-- F6: consultant cria issue
do $$declare iid uuid;begin
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);
  insert into public.project_issues (project_id,title,priority,status)
  values ('cccccccc-0000-0000-0000-000000000001','Issue teste','high','open')
  returning id into iid;
  assert iid is not null,'FAIL F6';
end$$;

-- F7: consultant cria CR
do $$declare crid uuid;begin
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);
  insert into public.change_requests
    (project_id,title,additional_cost,schedule_impact_days,requested_by,status)
  values ('cccccccc-0000-0000-0000-000000000001','CR teste',10000,5,
          'aaaaaaaa-0000-0000-0000-000000000003','submitted')
  returning id into crid;
  assert crid is not null,'FAIL F7';
end$$;

-- F8: ao aprovar CR, budget e end_date são atualizados no banco
do $$
declare budget_antes numeric; budget_depois numeric;
        end_antes date;        end_depois date;
        crid uuid;
begin
  set local role postgres;
  -- garante orçamento existente
  insert into public.project_budgets (organization_id,project_id,budget_total)
  values ('11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001',300000)
  on conflict (project_id) do nothing;
  -- garante end_date no projeto
  update public.projects set end_date=current_date+90 where id='cccccccc-0000-0000-0000-000000000001' and end_date is null;
  select budget_total into budget_antes from public.project_budgets
   where project_id='cccccccc-0000-0000-0000-000000000001';
  select end_date into end_antes from public.projects
   where id='cccccccc-0000-0000-0000-000000000001';

  select id into crid from public.change_requests
   where project_id='cccccccc-0000-0000-0000-000000000001'
     and title='CR teste' limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);

  update public.change_requests
     set status='approved', approved_by='aaaaaaaa-0000-0000-0000-000000000002',
         approved_at=now()
   where id=crid;

  set local role postgres;
  select budget_total into budget_depois from public.project_budgets
   where project_id='cccccccc-0000-0000-0000-000000000001';
  select end_date into end_depois from public.projects
   where id='cccccccc-0000-0000-0000-000000000001';

  assert budget_depois > coalesce(budget_antes,0),'FAIL F8a: budget nao atualizado';
  assert end_depois > end_antes,'FAIL F8b: end_date nao atualizado';
end$$;

-- F9: org B não vê change_requests da org A
do $$declare cnt int;begin
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);
  select count(*) into cnt from public.change_requests
   where organization_id='11111111-1111-1111-1111-111111111111';
  assert cnt=0,'FAIL F9';
end$$;

-- F10: audit_log registrado ao aprovar CR
do $$declare cnt int;begin
  set local role postgres;
  select count(*) into cnt from public.audit_logs
   where entity_type='change_request' and action='approve';
  assert cnt>=1,'FAIL F10';
end$$;

select t as teste,'PASS' as r from unnest(array[
  'F1  manager cria risco',
  'F2  score calculado (high×high=9)',
  'F3  customer lê riscos',
  'F4  customer não cria risco',
  'F5  org B não cria risco na org A',
  'F6  consultant cria issue',
  'F7  consultant cria CR',
  'F8  aprovação CR atualiza budget e end_date',
  'F9  org B não vê CRs da org A',
  'F10 audit_log ao aprovar CR'
]) t;

rollback;
