-- Fase 18 — Testes de isolamento entre organizações
-- Cobre as tabelas novas das Fases 14-17: resources, resource_allocations,
-- timesheets, task_comments. Roda em transação e reverte no final (não deixa resíduo).

begin;
set local role authenticated;

-- T1: manager.b (Org B) NÃO enxerga recursos da Org A
do $$declare cnt int;begin
  perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);
  select count(*) into cnt from public.resources
   where organization_id='11111111-1111-1111-1111-111111111111';
  assert cnt=0,'FAIL T1: manager.b enxergou recursos da Org A';
end$$;

-- T2: manager.b (Org B) NÃO enxerga timesheets da Org A
do $$declare cnt int;begin
  perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);
  select count(*) into cnt from public.timesheets
   where organization_id='11111111-1111-1111-1111-111111111111';
  assert cnt=0,'FAIL T2: manager.b enxergou timesheets da Org A';
end$$;

-- T3: consultant.a NÃO cria resource_allocations (só admin/manager podem)
do $$declare ok bool:=false;begin
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);
  begin
    insert into public.resource_allocations (resource_id, project_id, allocated_hours)
    values ('997b0d84-488b-4aad-b07b-d74af5920991','cccccccc-0000-0000-0000-000000000001', 10);
  exception when insufficient_privilege then ok:=true;
  end;
  assert ok,'FAIL T3: consultant.a conseguiu criar alocação';
end$$;

-- T4: manager.a (Org A) cria um comentário numa tarefa da Org A
do $$declare cid uuid; tid uuid;begin
  set local role postgres;
  select id into tid from public.tasks where organization_id='11111111-1111-1111-1111-111111111111' limit 1;
  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);
  insert into public.task_comments (task_id, author_id, body)
  values (tid, 'aaaaaaaa-0000-0000-0000-000000000002', 'Comentário de teste Fase 18')
  returning id into cid;
  assert cid is not null,'FAIL T4: manager.a não conseguiu comentar';
end$$;

-- T5: manager.b (Org B) NÃO enxerga o comentário criado em T4 (Org A)
do $$declare cnt int;begin
  perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);
  select count(*) into cnt from public.task_comments where body='Comentário de teste Fase 18';
  assert cnt=0,'FAIL T5: manager.b enxergou comentário da Org A';
end$$;

-- T6: consultant.a (mesma Org A) enxerga o comentário criado em T4
do $$declare cnt int;begin
  perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);
  select count(*) into cnt from public.task_comments where body='Comentário de teste Fase 18';
  assert cnt=1,'FAIL T6: consultant.a não enxergou comentário da própria org';
end$$;

select 'Fase 18: 6/6 testes de isolamento PASS' as resultado;

rollback;
