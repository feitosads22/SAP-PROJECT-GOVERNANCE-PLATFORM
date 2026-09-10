# SAP Project Governance Platform — Contexto para Claude Code

> Leia este arquivo antes de qualquer desenvolvimento.
> Ele contém toda a arquitetura, decisões técnicas e estado atual do projeto.

---

## Identificadores Críticos

```
Supabase project_id : cdqafumreeqsxyblcxds
Supabase URL        : https://cdqafumreeqsxyblcxds.supabase.co
GitHub repo         : https://github.com/feitosads22/SAP-PROJECT-GOVERNANCE-PLATFORM
Vercel URL          : https://sap-project-governance-platform-ca4.vercel.app
Vercel project_id   : prj_CtPoDpf6BbhI1YmG57VxdGqxglPo
```

## Stack

| Camada     | Tecnologia                          |
|------------|-------------------------------------|
| Frontend   | React 18 + TypeScript + Vite        |
| Roteamento | React Router v6                     |
| Drag-drop  | @dnd-kit/core + @dnd-kit/sortable   |
| Backend    | Supabase (Postgres + Auth + RLS)    |
| Storage    | Supabase Storage                    |
| Edge Fn    | Supabase Edge Functions (Deno)      |
| Deploy     | Vercel (auto-deploy via GitHub)     |
| IA interna | Anthropic API (claude-haiku)        |

## Usuários de Teste (senha: `teste123`)

| Email                      | Role       | Org        |
|----------------------------|------------|------------|
| admin.a@alpha.test         | admin      | Org Alpha  |
| manager.a@alpha.test       | manager    | Org Alpha  |
| consultant.a@alpha.test    | consultant | Org Alpha  |
| customer.a@alpha.test      | customer   | Org Alpha  |
| manager.b@beta.test        | manager    | Org Beta   |

---

## Arquitetura Frontend

### Layout principal (`src/App.tsx`)
```
AppLayout
├── AppSidebar   (sidebar esquerda fixa 260px, escura #071B33)
├── AppTopbar    (topbar branca 64px com GlobalSearch)
└── Routes       (conteúdo principal)
```

### Rotas registradas
```
/dashboard          → Dashboard (admin/manager) ou ConsultantDashboard
/                   → Projects (lista de projetos)
/projeto/:id        → ProjectDetail (abas)
/minhas             → MyTasks (Kanban pessoal)
/capacidade         → Capacity
/timesheet          → TimesheetPage
/portfolio          → PortfolioPage
/portal-cliente     → CustomerPortalPage
/projeto/:id/clientes   → CustomerManagePage
/knowledge          → KnowledgePage (IA + base de conhecimento)
/demandas           → DemandsPage (Change Requests)
/documentos         → DocumentsPage
/relatorios         → ReportsPage
/recursos           → ResourcesPage
/cronograma/:id     → SchedulePage (standalone)
/perfil             → ProfilePage
/configuracoes      → SettingsPage
/equipe             → TeamManagePage
/notificacoes       → NotificationsPage
```

### ProjectDetail — abas
```
overview   → Visão geral (cronograma, financeiro resumido, top riscos, issues)
tasks      → KanbanBoard (drag-and-drop por status)
risks      → GovernancePage embarcada (riscos, issues, CRs)
financial  → BudgetPage embarcada + FinancialChart
governance → GovernancePage embarcada
clientes   → CustomerManagePage embarcada
documentos → ProjectDocuments (upload/download por categoria)
cronograma → SchedulePage (Gantt + lista, criar marcos)
```

### Sidebar — grupos de navegação

| Grupo         | Itens                                           | Roles              |
|---------------|-------------------------------------------------|--------------------|
| Principal     | Dashboard, Projetos, Portfólio, Demandas        | admin, manager     |
| Principal     | Meu Painel                                      | consultant         |
| Execução      | Minhas Tarefas, Timesheet                       | todos              |
| Execução      | Capacidade                                      | admin, manager     |
| Análise       | Relatórios, Documentos, IA & Conhecimento       | admin, manager, consultant |
| Administração | Usuários & Perfis, Recursos, Configurações      | admin, manager     |
| Sistema       | Notificações                                    | todos              |
| Cliente       | Meus Projetos                                   | customer           |

---

## Banco de Dados — Tabelas Principais

### Tabelas de controle de acesso
```sql
organizations       -- multi-tenant root
profiles            -- usuários (role: admin|manager|consultant|customer)
project_members     -- alocação de consultores a projetos
project_invites     -- convites pendentes
project_customers   -- clientes vinculados a projetos
```

### Tabelas de projeto
```sql
projects            -- projeto SAP (status, priority, progress, sap_module, etc.)
milestones          -- marcos do projeto (status: not_started|in_progress|completed|cancelled)
tasks               -- tarefas (status, priority, sap_activate_phase, start_date, due_date, progress)
project_risks       -- riscos (probability, impact, score GENERATED)
project_issues      -- issues
change_requests     -- CRs (attachment_path, attachment_name, attachment_size)
```

### Tabelas financeiras
```sql
project_budgets         -- orçamento aprovado por projeto
project_costs           -- lançamentos de custo
project_forecasts       -- forecasts
project_monthly_budgets -- planejamento mensal (year_month, planned_cost)
```

### Views
```sql
portfolio_summary       -- KPIs por projeto (health_score, schedule_status, etc.)
project_financial       -- resumo financeiro por projeto
project_monthly_costs   -- custo realizado agrupado por mês
resource_capacity       -- capacidade e utilização por recurso
```

### Tabelas de recursos
```sql
resources           -- consultores/recursos (seniority, email, hourly_rate)
resource_allocations-- alocação mensal de recurso a projeto
timesheets          -- apontamento de horas (status: draft|submitted|approved|rejected)
```

### Tabelas de conhecimento / IA
```sql
knowledge_articles  -- base de conhecimento (full-text search tsvector)
project_manuals     -- manuais do projeto (storage)
project_documents   -- documentos do projeto por categoria
ai_conversations    -- histórico de conversas com IA
```

### Tabelas de comunicação
```sql
notifications       -- notificações por usuário
audit_logs          -- log de auditoria de ações
customer_updates    -- comunicados para clientes
```

---

## Regras Arquiteturais — NUNCA VIOLAR

1. **Toda tabela de negócio tem `organization_id NOT NULL`**
2. **RLS habilitado em todas as tabelas** — nunca desabilitar
3. **`service_role` nunca no frontend** — usar apenas `anon key`
4. **Migrations sequenciais** — nunca modificar migration já aplicada
5. **Trigger `set_org_id()`** preenche `organization_id` automaticamente no INSERT
6. **Trigger `check_evidence_before_completion`** bloqueia conclusão sem evidência aprovada
7. **Trigger `apply_change_request`** atualiza budget e end_date ao aprovar CR

---

## Funções RPC importantes

```sql
public.current_org_id()         -- org do usuário logado
public.current_role()           -- role do usuário logado
public.is_project_member(uuid)  -- verifica se user é membro do projeto
public.customer_has_project_access(uuid) -- verifica acesso de customer
public.calculate_health_score(uuid)      -- calcula health score 0-100
public.search_knowledge(text, int)       -- busca full-text na knowledge base
```

---

## Permissões por Role

| Ação                        | admin | manager | consultant | customer |
|-----------------------------|-------|---------|------------|----------|
| Ver dashboard executivo     | ✅    | ✅      | ❌         | ❌       |
| Ver dashboard consultor     | ❌    | ❌      | ✅         | ❌       |
| Criar projeto               | ✅    | ✅      | ❌         | ❌       |
| Ver projetos                | ✅    | ✅      | só alocados| só vinculados |
| Criar tarefa                | ✅    | ✅      | ❌         | ❌       |
| Mover tarefa (kanban)       | ✅    | ✅      | próprias   | ❌       |
| Aprovar timesheet           | ✅    | ✅      | ❌         | ❌       |
| Gerenciar usuários          | ✅    | ✅      | ❌         | ❌       |
| Ver valores financeiros     | ✅    | ✅      | ✅         | ❌       |
| Portal cliente              | ❌    | ❌      | ❌         | ✅       |

---

## Componentes Reutilizáveis

| Componente         | Função                                          |
|--------------------|-------------------------------------------------|
| `AppSidebar`       | Sidebar com nav por role                        |
| `AppTopbar`        | Header com GlobalSearch + notificações + avatar |
| `GlobalSearch`     | Busca em tempo real (projetos, tarefas, pessoas)|
| `KanbanBoard`      | Drag-and-drop de tarefas por status             |
| `CreateProjectModal` | Painel lateral para criar projeto             |
| `EditProjectModal` | Painel lateral para editar projeto              |
| `CreateTaskModal`  | Modal de criação de tarefa                      |
| `EditTaskModal`    | Painel lateral para editar tarefa               |
| `EvidencePanel`    | Gestão de evidências de tarefa                  |
| `FinancialChart`   | Gráfico Planejado × Realizado por mês           |
| `Toast`            | Sistema de notificações visuais inline          |
| `NotificationBell` | Sino com contagem (legacy, substituído)         |

---

## Design System (`src/styles.css`)

```css
/* Tokens principais */
--brand:        #0A6ED1   /* azul SAP */
--brand-dark:   #071B33   /* sidebar */
--bg:           #F5F7FA   /* fundo */
--surface:      #FFFFFF   /* cards */
--text:         #172B4D
--subtle:       #64748B
--ok:           #16A34A
--warn:         #F59E0B
--danger:       #DC2626
--sidebar-w:    260px
--topbar-h:     64px
```

**Padrões CSS usados:**
- `.page` — container de página (padding 1.75rem)
- `.card` + `.card__header` + `.card__body` — card padrão
- `.kpi-card` — card de KPI com ícone
- `.kpi-grid` — grid de KPIs
- `.table-wrap` — tabela com scroll horizontal
- `.filter-bar` — barra de filtros
- `.tabs` + `.tab-btn` — abas de navegação
- `.panel-overlay` + `.panel` — painel lateral (drawer)
- `.badge` + variantes — badges de status
- `.empty-state` — estado vazio
- `.skeleton` — loading skeleton

---

## Edge Functions (Supabase)

```
ask-ai (versão 2, ACTIVE)
  POST /functions/v1/ask-ai
  Body: { question: string, project_id?: string }
  - Busca artigos relevantes via search_knowledge()
  - Adiciona contexto do projeto via portfolio_summary
  - Chama Anthropic API (claude-haiku)
  - Salva em ai_conversations
```

---

## Buckets de Storage

```
task-evidence      -- evidências de tarefas
project-documents  -- documentos do projeto (usados por ProjectDocuments)
project-manuals    -- manuais (usados por KnowledgePage)
```

---

## Estado Atual — O que está PRONTO

### Fases concluídas (1–13)

| Fase | Entregue |
|------|----------|
| 1    | Auth, multi-tenant, projetos, perfis |
| 2    | Kanban com drag-and-drop, evidências, auditoria |
| 3    | Recursos, timesheet básico, capacidade |
| 4    | Orçamento, custos, forecasts, financeiro |
| 5    | Riscos, issues, change requests |
| 6    | Portfólio, health score (0-100, 5 componentes) |
| 7    | Portal do cliente, comunicados |
| 8    | Knowledge base, IA com Anthropic API |
| 9    | Gantt/Cronograma, ResourcesPage, ProfilePage, SettingsPage |
| 10   | Notificações, correções de UX (busca, usuários, criar projeto) |
| 11   | EditProjectModal, EditTaskModal, Toast, Export CSV, 404 |
| 12   | GlobalSearch (topbar funcional), criar/excluir marcos no Gantt |
| 13   | Timesheet com aprovação/rejeição, FinancialChart planejado×realizado |

---

## O que FALTA implementar (backlog)

### Alta prioridade
- [ ] **Envio de convite por email** (hoje cria o perfil mas não envia email real)
- [ ] **Paginação** nas tabelas com muitos registros
- [ ] **Exportar relatório PDF** (hoje só CSV)
- [ ] **Filtro de data** no timesheet (por semana/mês)
- [ ] **Alocação de recursos** a projetos via ResourcesPage (tabela `resource_allocations`)
- [ ] **Editar/excluir marcos** no cronograma via lista (hoje só no Gantt)

### Média prioridade
- [ ] **Dashboard do consultor** — mostrar horas lançadas vs planejadas
- [ ] **Relatório de horas por projeto** exportável
- [ ] **Notificações automáticas** (triggers no banco para tarefas vencendo, CRs aprovados)
- [ ] **Upload de foto de perfil**
- [ ] **Comentários em tarefas**

### Baixa prioridade
- [ ] **Dark mode**
- [ ] **PWA / offline support**
- [ ] **Integração com calendário** (Google Calendar)

---

## Como desenvolver com Claude Code

### Setup inicial
```bash
git clone https://github.com/feitosads22/SAP-PROJECT-GOVERNANCE-PLATFORM
cd SAP-PROJECT-GOVERNANCE-PLATFORM
npm install
cp .env.example .env.local
# Preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

### Variáveis de ambiente necessárias
```
VITE_SUPABASE_URL=https://cdqafumreeqsxyblcxds.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key do projeto>
```

### Antes de fazer commit sempre rodar
```bash
npx tsc --noEmit   # zero erros TS
npm run build      # build deve ter saída "✓ built"
```

### Convenções do projeto
- Usar `// eslint-disable-next-line @typescript-eslint/no-explicit-any` quando necessário para o Supabase client
- Sempre usar `toast('mensagem', 'ok'|'error'|'warn'|'info')` para feedback
- Permissões checadas via `role === 'admin' || role === 'manager'`
- `supabase as any` para queries dinâmicas (schema cache do Supabase não inclui colunas novas)
- Novos campos no banco: rodar migration SQL no Supabase Dashboard antes de usar no código
- Não usar colunas que não existem na tabela (verificar antes via SQL: `select column_name from information_schema.columns where table_name='xxx'`)

### Padrão de nova página
```tsx
// src/pages/NovaPagina.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from '../components/Toast'

type Props = { role: string }

export default function NovaPagina({ role }: Props) {
  // 1. Estados
  // 2. Load function com supabase as any
  // 3. useEffect chamando load
  // 4. Return com estrutura:
  //    <div className="page">
  //      <div className="page-header">...</div>
  //      <div className="kpi-grid">...</div>
  //      <div className="filter-bar">...</div>
  //      {loading ? <skeleton> : <content>}
  //    </div>
}
```

### Padrão de nova rota
```tsx
// Em src/App.tsx — adicionar import e Route:
import NovaPagina from './pages/NovaPagina'
// ...
<Route path="/nova" element={<NovaPagina role={role} />} />

// Em src/components/AppSidebar.tsx — adicionar no array NAV:
{ to:'/nova', label:'Nova Página', icon:'🆕', roles:['admin','manager'] }
```

---

## Arquivos-chave para entender o projeto

```
src/App.tsx                    — layout raiz + todas as rotas
src/styles.css                 — design system completo
src/contexts/AuthContext.tsx   — autenticação e perfil do usuário
src/lib/supabase.ts            — cliente Supabase
src/lib/api.ts                 — funções de acesso ao banco
src/lib/financial.ts           — funções financeiras
src/lib/resources.ts           — funções de recursos e timesheet
src/types/app.types.ts         — tipos TypeScript do projeto
src/types/database.types.ts    — tipos gerados do Supabase
```
