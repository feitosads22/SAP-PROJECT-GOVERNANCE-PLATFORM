-- =====================================================================
-- Testes Fase 4 — Orçamento + Custos + Forecast
-- Rodar após: 0005_budget_financial.sql
-- Termina em ROLLBACK. Qualquer assert falho aborta com FAIL En.
-- =====================================================================

begin;
set local role authenticated;

-- E1: manager cria orçamento
do $$
declare bid uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);
  insert into public.project_budgets
    (project_id, budget_total, revenue_planned, cost_planned)
  values ('cccccccc-0000-0000-0000-000000000001', 500000, 600000, 400000)
  returning id into bid;
  assert bid is not null, 'FAIL E1';
end $$;

-- E2: customer não acessa budgets
do $$
declare cnt int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}',true);
  select count(*) into cnt from public.project_budgets
   where organization_id = '11111111-1111-1111-1111-111111111111';
  assert cnt = 0, 'FAIL E2';
end $$;

-- E3: org B não vê budgets da org A
do $$
declare cnt int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);
  select count(*) into cnt from public.project_budgets
   where organization_id = '11111111-1111-1111-1111-111111111111';
  assert cnt = 0, 'FAIL E3';
end $$;

-- E4: manager lança custo manual
do $$
declare cid uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);
  insert into public.project_costs
    (project_id, category, description, amount, cost_date, created_by)
  values ('cccccccc-0000-0000-0000-000000000001',
          'software','Licença SAP',15000,current_date,
          'aaaaaaaa-0000-0000-0000-000000000002')
  returning id into cid;
  assert cid is not null, 'FAIL E4';
end $$;

-- E5: consultant não cria custo manual
do $$
declare ok bool := false;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);
  begin
    insert into public.project_costs
      (project_id,category,description,amount)
    values ('cccccccc-0000-0000-0000-000000000001','other','Custo pirata',100);
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'FAIL E5';
end $$;

-- E6: manager cria forecast
do $$
declare fid uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);
  insert into public.project_forecasts
    (project_id, cost_forecast, revenue_forecast, notes)
  values ('cccccccc-0000-0000-0000-000000000001', 420000, 590000, 'Semana 1')
  returning id into fid;
  assert fid is not null, 'FAIL E6';
end $$;

-- E7: view project_financial calcula corretamente
do $$
declare budget_v numeric; cost_v numeric; forecast_v numeric; status_v text;
begin
  set local role postgres;
  select budget_total, cost_actual_total, cost_forecast, financial_status
    into budget_v, cost_v, forecast_v, status_v
  from public.project_financial
  where project_id = 'cccccccc-0000-0000-0000-000000000001';

  assert budget_v = 500000,    'FAIL E7a: budget incorreto';
  assert cost_v >= 15000,      'FAIL E7b: custo não contabilizado';
  assert forecast_v = 420000,  'FAIL E7c: forecast incorreto';
  assert status_v in ('ok','atencao','estourado','sem_orcamento'), 'FAIL E7d: status inválido';
end $$;

-- E8: customer não acessa project_costs
do $$
declare cnt int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}',true);
  select count(*) into cnt from public.project_costs
   where organization_id = '11111111-1111-1111-1111-111111111111';
  assert cnt = 0, 'FAIL E8';
end $$;

-- E9: org B não vê costs da org A
do $$
declare cnt int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);
  select count(*) into cnt from public.project_costs
   where organization_id = '11111111-1111-1111-1111-111111111111';
  assert cnt = 0, 'FAIL E9';
end $$;

-- E10: audit_log ao aprovar orçamento
do $$
declare cnt int;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);

  update public.project_budgets
     set approved_by = 'aaaaaaaa-0000-0000-0000-000000000001',
         approved_at = now()
   where project_id = 'cccccccc-0000-0000-0000-000000000001'
     and approved_by is null;

  set local role postgres;
  select count(*) into cnt from public.audit_logs
   where entity_type = 'budget' and action = 'approve';

  assert cnt >= 1, 'FAIL E10';
end $$;

select t as teste, 'PASS' as r
from unnest(array[
  'E1  manager cria orçamento',
  'E2  customer não acessa budgets',
  'E3  org B não vê budgets da org A',
  'E4  manager lança custo manual',
  'E5  consultant não cria custo',
  'E6  manager cria forecast',
  'E7  project_financial calcula corretamente',
  'E8  customer não acessa costs',
  'E9  org B não vê costs da org A',
  'E10 audit_log ao aprovar orçamento'
]) t;

rollback;
