# PROJECT_STATE.md

**Plataforma:** SAP Project Governance Platform (multi-tenant)
**Última atualização:** 05/09/2026
**Fase atual:** 1A — Fundação (banco validado **no Supabase real**; frontend **não** iniciado)

---

## Situação

A migration `0001_foundation_auth_orgs_projects.sql` e o seed foram aplicados e
executados de verdade em PostgreSQL 16 com um harness que reproduz o ambiente
Supabase (schema `auth`, `auth.uid()`, `auth.role()`, roles `anon`/`authenticated`).

A suíte original de 10 testes de RLS passou — **e mesmo assim o isolamento entre
organizações estava quebrado**. Os testes não cobriam a tabela `profiles` como
vetor de ataque.

Correção aplicada em `0001b_hotfix_tenancy_privilege.sql`, com rollback e suíte
ampliada para 21 testes.

---

## Falhas encontradas na 0001 (com output real)

| # | Falha | Severidade | Status |
|---|-------|-----------|--------|
| 1 | `profiles_update_self_or_admin` permite ao usuário alterar o **próprio `role`**. Um `customer` vira `admin`. | Crítica | Corrigida |
| 2 | Consequência de (1): promovido, o usuário altera projetos da organização. | Crítica | Corrigida |
| 3 | Usuário altera a **própria `organization_id`** e passa a ler os dados da outra organização. Viola o critério de conclusão da Fase 1A. | Crítica | Corrigida |
| 4 | `organizations_insert_own` permite a qualquer autenticado criar organização sem limite. | Alta | Corrigida |
| 5 | Sem `unique (project_id, code)` em `project_modules` / `phases` / `wbs_items`. O seed seleciona módulo por `code` e retornaria linha arbitrária. | Média | Corrigida |
| 6 | `task_dependencies` aceita tarefa dependendo de si mesma. | Baixa | Corrigida |
| 7 | Migration não concede privilégios a `anon`/`authenticated`; depende dos default privileges do projeto Supabase. | Média | Corrigida (grants explícitos) |
| 8 | Suíte de testes terminava em `commit`, deixando resíduo (`progress=60`) no seed. | Média | Corrigida (`rollback`) |
| 9 | Migration 0001 não tem script de rollback, exigido pelas regras do projeto. | Média | Pendente para a 0001 |

### Output antes do hotfix
```
P1 escalonamento de role: linhas=1 role_agora=admin
P2 customer-virou-admin alterou 1 projeto(s)
P3 troca de tenant: linhas=1 projetos_da_org_B_visiveis=1
P4 criacao de organizacao por customer: linhas=1
P8 module code duplicado aceito: linhas=1
```

### Output depois do hotfix
```
ERROR:  PRIV_DENIED: alteracao de role exige admin da propria organizacao
ERROR:  PRIV_DENIED: alteracao de organization_id exige admin da propria organizacao
P4 bloqueado: new row violates row-level security policy for table "organizations"
P6 projetos visiveis ao anon=0
P7 bloqueado: new row violates row-level security policy for table "tasks"
P8 bloqueado: duplicate key value violates unique constraint "project_modules_project_code_uidx"
```

### Validação no Supabase real (05/09/2026)
Seed adaptado aplicado (`orgs=2 profiles_vinculados=5 identities=5 projetos=2 modulos=3 tarefas=2`),
hotfix aplicado (`hotfix_ja_aplicado=1`), suíte executada no SQL Editor: **21/21 PASS**.
Nota de ferramenta: o SQL Editor do Supabase não exibe `raise notice`; testes devem
retornar tabela em vez de notice.

### Suíte RLS v2 — 21/21 PASS
T1–T10 (originais) + T11 escalonamento de role · T12 troca de tenant no profile ·
T13 criação indevida de organização · T14 alterar role de terceiro ·
T15 admin promove (caminho legítimo preservado) · T16 manager cria projeto ·
T17 manager B altera task da A · T18 mover task de tenant ·
T19 manager B vê profiles da A · T20 insert direto em `task_history` ·
T21 acesso anônimo.

Onboarding verificado: `create_organization()` cria a organização e promove o
criador a admin; segunda chamada pelo mesmo usuário é bloqueada.
Rollback verificado: `down` aplica limpo e reabre a falha (comprovando que era
o hotfix que a fechava); `up` reaplicado deixa 21/21 PASS. Hotfix é idempotente.

---

## Schema atual (Fase 1A)

`organizations` · `profiles` · `projects` · `project_modules` · `wbs_items` ·
`phases` · `milestones` · `tasks` · `task_dependencies` · `task_history`

Todas com `organization_id not null` (exceto `organizations` e `profiles`, onde
o vínculo é o próprio id / FK nullable para usuário `pending`).

**Funções:** `current_org_id()` · `current_role()` · `handle_new_user()` ·
`set_org_id()` · `log_task_change()` · `set_updated_at()` ·
`enforce_profile_privileges()` *(novo)* · `create_organization()` *(novo)*

**Migrations aplicadas (Supabase real):** `0001_foundation_auth_orgs_projects.sql`,
`0001b_hotfix_tenancy_privilege.sql`

**Policies:** SELECT/INSERT/UPDATE/DELETE por tabela, todas com
`organization_id = current_org_id()` + filtro de role.
`task_history`: somente SELECT (escrita via trigger SECURITY DEFINER).

---

## Pendências conhecidas

1. **`customer` enxerga todos os projetos da organização** (`projects_select` filtra só por tenant). O portal do cliente (Fase 7) exige vínculo projeto–cliente. Decidir se antecipa o filtro por `customer_id` ou mantém para a Fase 7.
2. **Migration 0001 sem script de rollback.**
3. ~~Seed sem `auth.identities`.~~ **Resolvido** em `supabase/seed/001_seed_supabase.sql` (identities criadas com montagem dinâmica de colunas). Login por e-mail/senha ainda não exercitado pela UI.
4. `public.current_role()` colide com a palavra reservada `current_role`. Funciona porque as policies sempre qualificam com `public.`, mas qualquer chamada não qualificada retorna o role do Postgres, não o da aplicação. Renomear para `current_app_role()`.
5. RLS não está em `force` — o owner da tabela ignora RLS. Aceitável no Supabase (API usa `authenticated`), mas vale registrar.
6. `profiles.email` duplica `auth.users.email` sem sincronização em update.
7. Frontend, types TypeScript (`supabase gen types`) e commit no GitHub: **não feitos**.

---

## Próxima etapa planejada

Concluir a Fase 1A: aplicar o hotfix no Supabase real → regenerar types
TypeScript → construir o frontend (login, seleção de organização, lista de
projetos, kanban básico de tarefas) consumindo apenas os types gerados →
testes de UI (happy path + tentativa de violação de permissão pela UI) →
commit → apresentar → **PARAR**.

Aguardando autorização explícita.
