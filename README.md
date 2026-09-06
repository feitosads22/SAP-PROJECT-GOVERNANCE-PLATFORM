# SAP Project Governance Platform

Plataforma multi-tenant para governança, execução e documentação de projetos SAP.
Isolamento entre organizações garantido no banco (RLS), não no frontend.

**Fase atual: 1A — Fundação.** Ver `PROJECT_STATE.md` para o estado detalhado,
falhas encontradas e pendências.

## Stack

React + TypeScript + Vite · Supabase (Postgres, Auth, RLS)

## Como rodar

```bash
npm install
cp .env.example .env      # preencher com a URL e a anon key do projeto
npm run dev
```

Apenas a **anon key** entra no frontend. A `service_role` nunca.

## Banco

Aplicar no SQL Editor do Supabase, nesta ordem:

| # | Arquivo | O que faz |
|---|---------|-----------|
| 1 | `supabase/migrations/0001_foundation_auth_orgs_projects.sql` | Schema da Fase 1A |
| 2 | `supabase/migrations/0001b_hotfix_tenancy_privilege.sql` | Fecha escalonamento de privilégio e troca de tenant |
| 3 | `supabase/seed/001_seed_supabase.sql` | Dados de teste (2 orgs, 5 usuários, senha `teste123`) |
| 4 | `supabase/tests/0001_rls_tests_v2.sql` | Suíte de RLS — deve retornar 21 linhas `PASS` |

Rollback do hotfix: `0001b_hotfix_tenancy_privilege_down.sql`.
Reverter reabre a falha de escalonamento — ver `PROJECT_STATE.md`.

## Testes

A suíte de RLS roda dentro de uma transação que termina em `ROLLBACK`: não deixa
resíduo. Qualquer assert falho aborta com `FAIL Tn` identificando o teste.

Cobre isolamento entre organizações, entre roles, tentativa de escalonamento de
privilégio via `profiles`, spoofing de `organization_id` no insert e acesso anônimo.

Para rodar fora do Supabase (Postgres local), aplicar antes
`supabase/tests/00_local_harness.sql`, que recria o mínimo do ambiente Supabase
(schema `auth`, `auth.uid()`, roles `anon`/`authenticated`).

## Types

`src/types/database.types.ts` reflete o schema real. O frontend só consome estes
types — campo que não existe no banco não compila.

Regenerar:

```bash
supabase gen types typescript --project-id <ref> > src/types/database.types.ts
```

Sem a CLI, `supabase/tools/gen_types_from_schema.sql` extrai o equivalente pelo
SQL Editor.

## Regras do projeto

- Nunca modificar migration já aplicada — criar nova.
- Nunca desabilitar RLS para corrigir problema — corrigir a policy.
- Nunca resolver falha de segurança apenas no frontend.
- Toda tabela de negócio tem `organization_id`.
- Cada fase termina com testes reais executados, commit e `PROJECT_STATE.md` atualizado.
