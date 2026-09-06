-- =====================================================================
-- Testes RLS Fase 1A — v2
-- Rodar após: 0001_foundation + 0001b_hotfix + 001_seed
-- Uma transação; qualquer assert falho aborta com 'FAIL Tn'.
-- Termina em ROLLBACK: a suíte não deixa resíduo no banco.
-- =====================================================================
begin;
delete from public.projects where code in ('FAKE-1','FAKE-2');
set local role authenticated;

-- ---------- T1..T10: cobertura original ----------
do $$declare cnt int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);select count(*) into cnt from public.projects where code='ALPHA-S4' and organization_id='11111111-1111-1111-1111-111111111111';assert cnt=1,'FAIL T1';end$$;

do $$declare cnt int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);select count(*) into cnt from public.projects where organization_id='22222222-2222-2222-2222-222222222222';assert cnt=0,'FAIL T2';end$$;

do $$declare cnt int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);select count(*) into cnt from public.profiles where organization_id='22222222-2222-2222-2222-222222222222';assert cnt=0,'FAIL T3';end$$;

do $$declare n int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}',true);update public.tasks set progress=99 where organization_id='11111111-1111-1111-1111-111111111111';get diagnostics n=row_count;assert n=0,'FAIL T4';end$$;

do $$declare n int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}',true);update public.projects set status='completed' where organization_id='11111111-1111-1111-1111-111111111111';get diagnostics n=row_count;assert n=0,'FAIL T5';end$$;

do $$declare n int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);delete from public.tasks where organization_id='11111111-1111-1111-1111-111111111111';get diagnostics n=row_count;assert n=0,'FAIL T6';end$$;

do $$declare n int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);update public.tasks set progress=60 where assignee_id='aaaaaaaa-0000-0000-0000-000000000003';get diagnostics n=row_count;assert n=2,'FAIL T7';end$$;

do $$declare s int;declare o int;declare v int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);insert into public.projects (organization_id,name,code) values ('22222222-2222-2222-2222-222222222222','Projeto Fake','FAKE-1');select count(*) into s from public.projects where code='FAKE-1' and organization_id='11111111-1111-1111-1111-111111111111';assert s=1,'FAIL T8a';select count(*) into o from public.projects where organization_id='11111111-1111-1111-1111-111111111111';assert o=2,'FAIL T8b';select count(*) into v from public.projects where organization_id='22222222-2222-2222-2222-222222222222';assert v=0,'FAIL T8c';delete from public.projects where code='FAKE-1';end$$;

do $$declare cnt int;begin perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);select count(*) into cnt from public.projects where organization_id='11111111-1111-1111-1111-111111111111';assert cnt=0,'FAIL T9';end$$;

do $$declare n int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);update public.tasks set progress=10 where organization_id='22222222-2222-2222-2222-222222222222';get diagnostics n=row_count;assert n=0,'FAIL T10';end$$;

-- ---------- T11..T20: escalonamento de privilégio e troca de tenant ----------

-- T11: customer não pode se promover a admin
do $$declare ok bool:=false;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}',true);begin update public.profiles set role='admin' where id='aaaaaaaa-0000-0000-0000-000000000004';exception when insufficient_privilege then ok:=true;end;assert ok,'FAIL T11';end$$;

-- T12: consultor não pode mudar a própria organization_id (tenant hopping)
do $$declare ok bool:=false;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);begin update public.profiles set organization_id='22222222-2222-2222-2222-222222222222' where id='aaaaaaaa-0000-0000-0000-000000000003';exception when insufficient_privilege then ok:=true;end;assert ok,'FAIL T12';end$$;

-- T13: quem já tem organização não cria outra
do $$declare ok bool:=false;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}',true);begin insert into public.organizations (name,slug) values ('Org Pirata','org-pirata');exception when insufficient_privilege then ok:=true;end;assert ok,'FAIL T13';end$$;

-- T14: consultor não altera o role de outro usuário da própria org
do $$declare ok bool:=false;declare n int;declare r text;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);begin update public.profiles set role='admin' where id='aaaaaaaa-0000-0000-0000-000000000004';get diagnostics n=row_count;ok:=(n=0);exception when insufficient_privilege then ok:=true;end;select role into r from public.profiles where id='aaaaaaaa-0000-0000-0000-000000000004';assert ok and r='customer','FAIL T14';end$$;

-- T15: admin da própria org PODE promover (caminho legítimo preservado)
do $$declare n int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',true);update public.profiles set role='manager' where id='aaaaaaaa-0000-0000-0000-000000000004';get diagnostics n=row_count;assert n=1,'FAIL T15';update public.profiles set role='customer' where id='aaaaaaaa-0000-0000-0000-000000000004';end$$;

-- T16: manager Alpha cria projeto e ele nasce na org Alpha
do $$declare cnt int;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);insert into public.projects (organization_id,name,code) values ('11111111-1111-1111-1111-111111111111','Projeto Fake 2','FAKE-2');select count(*) into cnt from public.projects where code='FAKE-2' and organization_id='11111111-1111-1111-1111-111111111111';assert cnt=1,'FAIL T16';delete from public.projects where code='FAKE-2';end$$;

-- T17: manager Beta não altera tarefa da Alpha
do $$declare n int;begin perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);update public.tasks set status='completed' where organization_id='11111111-1111-1111-1111-111111111111';get diagnostics n=row_count;assert n=0,'FAIL T17';end$$;

-- T18: consultor não move a própria tarefa para outra organização
do $$declare ok bool:=false;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);begin update public.tasks set organization_id='22222222-2222-2222-2222-222222222222' where assignee_id='aaaaaaaa-0000-0000-0000-000000000003';exception when insufficient_privilege then ok:=true;end;assert ok,'FAIL T18';end$$;

-- T19: manager Beta não enxerga profiles da Alpha
do $$declare cnt int;begin perform set_config('request.jwt.claims','{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);select count(*) into cnt from public.profiles where organization_id='11111111-1111-1111-1111-111111111111';assert cnt=0,'FAIL T19';end$$;

-- T20: task_history é somente leitura para o usuário (escrita só via trigger)
do $$declare ok bool:=false;begin perform set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);begin insert into public.task_history (organization_id,task_id,field,new_value) select '11111111-1111-1111-1111-111111111111',id,'status','hack' from public.tasks limit 1;exception when insufficient_privilege then ok:=true;end;assert ok,'FAIL T20';end$$;

-- T21: anon não lê nada
set local role anon;
do $$declare cnt int;begin perform set_config('request.jwt.claims','',true);select count(*) into cnt from public.projects;assert cnt=0,'FAIL T21';end$$;
set local role authenticated;

select t as teste, 'PASS' as r
from unnest(array[
 'T1  select proprio tenant','T2  cross-tenant projects','T3  cross-tenant profiles',
 'T4  customer update task','T5  customer update project','T6  consultor delete task',
 'T7  consultor update propria task','T8  insert com org spoofada','T9  org B nao ve org A',
 'T10 consultor cross-tenant update','T11 escalonamento de role','T12 troca de tenant no profile',
 'T13 criacao indevida de org','T14 alterar role de terceiro','T15 admin promove (legitimo)',
 'T16 manager cria projeto','T17 manager B altera task A','T18 mover task de tenant',
 'T19 manager B ve profiles A','T20 insert em task_history','T21 acesso anonimo'
]) as t;

rollback;
