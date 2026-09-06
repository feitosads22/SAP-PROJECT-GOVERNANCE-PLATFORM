-- Testes Fase 6 — Health Score + Portfolio
begin;
set local role authenticated;

-- G1: calculate_health_score retorna valor entre 0 e 100
do $$declare sc numeric;begin
  set local role postgres;
  sc := public.calculate_health_score('cccccccc-0000-0000-0000-000000000001');
  assert sc between 0 and 100, 'FAIL G1: score fora do range: ' || sc;
end$$;

-- G2: snapshot foi persistido
do $$declare cnt int;begin
  set local role postgres;
  select count(*) into cnt from public.project_health_scores
   where project_id='cccccccc-0000-0000-0000-000000000001';
  assert cnt >= 1, 'FAIL G2';
end$$;

-- G3: status coerente com o score
do $$declare sc numeric; st text;begin
  set local role postgres;
  select score, status into sc, st from public.project_health_scores
   where project_id='cccccccc-0000-0000-0000-000000000001'
   order by calculated_at desc limit 1;
  assert
    (sc >= 85 and st = 'healthy')  or
    (sc >= 70 and st = 'attention') or
    (sc >= 50 and st = 'at_risk')  or
    (sc <  50 and st = 'critical'),
    'FAIL G3: status incompativel com score ' || sc || ' / ' || st;
end$$;

-- G4: usuário autenticado lê health scores da própria org
do $$declare cnt int;begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);
  select count(*) into cnt from public.project_health_scores
   where organization_id='11111111-1111-1111-1111-111111111111';
  assert cnt >= 1, 'FAIL G4';
end$$;

-- G5: org B não vê health scores da org A
do $$declare cnt int;begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);
  select count(*) into cnt from public.project_health_scores
   where organization_id='11111111-1111-1111-1111-111111111111';
  assert cnt = 0, 'FAIL G5';
end$$;

-- G6: insert direto em health_scores é bloqueado
do $$declare ok bool:=false;begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);
  begin
    insert into public.project_health_scores
      (organization_id,project_id,score,status)
    values ('11111111-1111-1111-1111-111111111111',
            'cccccccc-0000-0000-0000-000000000001',99,'healthy');
  exception when others then ok:=true;
  end;
  assert ok, 'FAIL G6';
end$$;

-- G7: portfolio_summary retorna o projeto com health_score
do $$declare cnt int; sc numeric;begin
  set local role postgres;
  select count(*), max(health_score) into cnt, sc
  from public.portfolio_summary
  where organization_id='11111111-1111-1111-1111-111111111111';
  assert cnt >= 1, 'FAIL G7a: sem projetos no portfolio';
  assert sc is not null, 'FAIL G7b: health_score nulo';
end$$;

-- G8: portfolio_summary inclui contadores corretos
do $$declare v_tasks_open int; v_fin_status text;begin
  set local role postgres;
  select tasks_open, financial_status into v_tasks_open, v_fin_status
  from public.portfolio_summary
  where project_id='cccccccc-0000-0000-0000-000000000001';
  assert v_tasks_open >= 0, 'FAIL G8a';
  assert v_fin_status in ('ok','atencao','estourado','sem_orcamento'), 'FAIL G8b';
end$$;

-- G9: múltiplos cálculos geram múltiplos snapshots (histórico)
do $$declare cnt1 int; cnt2 int;begin
  set local role postgres;
  select count(*) into cnt1 from public.project_health_scores
   where project_id='cccccccc-0000-0000-0000-000000000001';
  perform public.calculate_health_score('cccccccc-0000-0000-0000-000000000001');
  select count(*) into cnt2 from public.project_health_scores
   where project_id='cccccccc-0000-0000-0000-000000000001';
  assert cnt2 = cnt1 + 1, 'FAIL G9';
end$$;

-- G10: calculate_health_score pode ser chamada por authenticated
do $$declare sc numeric;begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);
  sc := public.calculate_health_score('cccccccc-0000-0000-0000-000000000001');
  assert sc between 0 and 100, 'FAIL G10';
end$$;

select t as teste, 'PASS' as r from unnest(array[
  'G1  score entre 0 e 100',
  'G2  snapshot persistido',
  'G3  status coerente com score',
  'G4  usuario le health scores da propria org',
  'G5  org B nao ve scores da org A',
  'G6  insert direto bloqueado',
  'G7  portfolio_summary com health_score',
  'G8  portfolio com contadores corretos',
  'G9  historico de snapshots',
  'G10 authenticated pode calcular score'
]) t;

rollback;
