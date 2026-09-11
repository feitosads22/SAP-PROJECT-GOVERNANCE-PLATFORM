-- Fase 17 — Comentários & Colaboração
-- Histórico de alterações (task_history) já existe desde a Fase 1 — nada a fazer ali.
-- Este script cria só a tabela de comentários em tarefas.

begin;

create table if not exists public.task_comments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id         uuid not null references public.tasks(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists task_comments_task_id_idx         on public.task_comments (task_id);
create index if not exists task_comments_organization_id_idx on public.task_comments (organization_id);

alter table public.task_comments enable row level security;

drop trigger if exists trg_task_comments_org_id on public.task_comments;
create trigger trg_task_comments_org_id
  before insert on public.task_comments
  for each row execute function public.set_org_id();

drop trigger if exists trg_task_comments_updated_at on public.task_comments;
create trigger trg_task_comments_updated_at
  before update on public.task_comments
  for each row execute function public.set_updated_at();

drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments for select
  using (organization_id = current_org_id());

drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments for insert
  with check (organization_id = current_org_id() and author_id = auth.uid());

drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments for delete
  using (organization_id = current_org_id() and (author_id = auth.uid() or "current_role"() in ('admin','manager')));

commit;
