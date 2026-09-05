-- Testes RLS Fase 1A (rodar após migration 0001 + seed). Uma transação:
-- qualquer assert falho aborta com erro 'FAIL Tn'. Sucesso = tabela 10 PASS.
begin;
delete from public.projects where code='FAKE-1';
set local role authenticated;

do $$declare cnt int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);select count(*) into cnt from public.projects where code='ALPHA-S4' and organization_id='11111111-1111-1111-1111-111111111111';assert cnt=1,'FAIL T1';end$$;

do $$declare cnt int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);select count(*) into cnt from public.projects where organization_id='22222222-2222-2222-2222-222222222222';assert cnt=0,'FAIL T2';end$$;

do $$declare cnt int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);select count(*) into cnt from public.profiles where organization_id='22222222-2222-2222-2222-222222222222';assert cnt=0,'FAIL T3';end$$;

do $$declare n int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}',true);update public.tasks set progress=99 where organization_id='11111111-1111-1111-1111-111111111111';get diagnostics n=row_count;assert n=0,'FAIL T4';end$$;

do $$declare n int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}',true);update public.projects set status='completed' where organization_id='11111111-1111-1111-1111-111111111111';get diagnostics n=row_count;assert n=0,'FAIL T5';end$$;

do $$declare n int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);delete from public.tasks where organization_id='11111111-1111-1111-1111-111111111111';get diagnostics n=row_count;assert n=0,'FAIL T6';end$$;

do $$declare n int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);update public.tasks set progress=60 where assignee_id='aaaaaaaa-0000-0000-0000-000000000003';get diagnostics n=row_count;assert n=2,'FAIL T7';end$$;

do $$declare s int;declare o int;declare v int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);delete from public.projects where code='FAKE-1';insert into public.projects (organization_id,name,code) values ('22222222-2222-2222-2222-222222222222','Projeto Fake','FAKE-1');select count(*) into s from public.projects where code='FAKE-1' and organization_id='11111111-1111-1111-1111-111111111111';assert s=1,'FAIL T8a';select count(*) into o from public.projects where organization_id='11111111-1111-1111-1111-111111111111';assert o=2,'FAIL T8b';select count(*) into v from public.projects where organization_id='22222222-2222-2222-2222-222222222222';assert v=0,'FAIL T8c';delete from public.projects where code='FAKE-1';end$$;

do $$declare cnt int;begin perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);select count(*) into cnt from public.projects where organization_id='11111111-1111-1111-1111-111111111111';assert cnt=0,'FAIL T9';end$$;

do $$declare n int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);update public.tasks set progress=10 where organization_id='22222222-2222-2222-2222-222222222222';get diagnostics n=row_count;assert n=0,'FAIL T10';end$$;

select 'TESTE 1' as teste,'PASS' as r union all select 'TESTE 2','PASS' union all select 'TESTE 3','PASS' union all select 'TESTE 4','PASS' union all select 'TESTE 5','PASS' union all select 'TESTE 6','PASS' union all select 'TESTE 7','PASS' union all select 'TESTE 8','PASS' union all select 'TESTE 9','PASS' union all select 'TESTE 10','PASS';
commit;
