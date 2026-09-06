-- =====================================================================
-- BLOCO A — DIAGNÓSTICO (rodar ANTES do hotfix)
-- Supabase > SQL Editor. Não altera nada: termina em ROLLBACK.
-- Objetivo: confirmar no banco real se a falha de escalonamento existe.
-- =====================================================================

-- ---------------------------------------------------------------
-- A0. Pré-requisitos: a migration 0001 e o seed estão aplicados?
-- ---------------------------------------------------------------
select
  (select count(*) from pg_tables where schemaname='public'
     and tablename in ('organizations','profiles','projects','project_modules',
                       'wbs_items','phases','milestones','tasks',
                       'task_dependencies','task_history'))            as tabelas_esperadas_10,
  (select count(*) from pg_policies where schemaname='public')          as policies,
  (select count(*) from public.organizations
     where id in ('11111111-1111-1111-1111-111111111111',
                  '22222222-2222-2222-2222-222222222222'))             as orgs_do_seed_2,
  (select count(*) from public.profiles
     where id::text like 'aaaaaaaa-%' or id::text like 'bbbbbbbb-%')    as usuarios_do_seed_5,
  (select count(*) from public.profiles
     where organization_id is null and role='pending')                  as profiles_orfaos,
  (select count(*) from pg_trigger
     where tgname='trg_profiles_enforce_privileges')                    as hotfix_ja_aplicado_0;

-- Esperado antes do hotfix:
-- tabelas=10 | orgs=2 | usuarios=5 | hotfix_ja_aplicado=0
-- Se orgs/usuarios vierem 0, o seed não foi aplicado: os testes abaixo
-- não têm em que rodar. Se usuarios vier < 5, o insert direto em
-- auth.users falhou (pendência 3 do PROJECT_STATE).


-- ---------------------------------------------------------------
-- A1. As três provas. Nada é gravado: ROLLBACK no fim.
-- ---------------------------------------------------------------
begin;
set local role authenticated;

-- P1 — customer da Org A tenta se promover a admin
do $$
declare n int; r text;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}', true);
  update public.profiles set role='admin'
   where id='aaaaaaaa-0000-0000-0000-000000000004';
  get diagnostics n = row_count;
  select role into r from public.profiles
   where id='aaaaaaaa-0000-0000-0000-000000000004';
  raise notice 'P1 escalonamento de role -> linhas=% role_agora=%', n, r;
exception when insufficient_privilege then
  raise notice 'P1 BLOQUEADO (esperado apos o hotfix): %', sqlerrm;
end $$;

-- P2 — já como admin, altera projetos da organização
do $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}', true);
  update public.projects set status='cancelled'
   where organization_id='11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  raise notice 'P2 customer-virou-admin alterou % projeto(s)', n;
exception when others then
  raise notice 'P2 bloqueado: %', sqlerrm;
end $$;

rollback;

-- P3 — troca de tenant: usuário da Org A se move para a Org B e lê a Org B
begin;
set local role authenticated;
do $$
declare n int; cnt int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
  update public.profiles set organization_id='22222222-2222-2222-2222-222222222222'
   where id='aaaaaaaa-0000-0000-0000-000000000003';
  get diagnostics n = row_count;
  select count(*) into cnt from public.projects
   where organization_id='22222222-2222-2222-2222-222222222222';
  raise notice 'P3 troca de tenant -> linhas=% projetos_da_org_B_visiveis=%', n, cnt;
exception when insufficient_privilege then
  raise notice 'P3 BLOQUEADO (esperado apos o hotfix): %', sqlerrm;
end $$;
rollback;

-- =====================================================================
-- Como ler o resultado (aba "Messages"/notices do SQL Editor):
--
--   P1 ... linhas=1 role_agora=admin                 -> FALHA CONFIRMADA
--   P2 ... alterou 1 projeto(s)                      -> FALHA CONFIRMADA
--   P3 ... linhas=1 projetos_da_org_B_visiveis=1     -> FALHA CONFIRMADA
--
-- Depois de aplicar 0001b_hotfix_tenancy_privilege.sql, os três devem
-- virar "BLOQUEADO ... PRIV_DENIED".
-- =====================================================================
