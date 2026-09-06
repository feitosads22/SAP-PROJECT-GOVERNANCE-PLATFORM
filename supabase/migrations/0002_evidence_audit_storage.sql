-- =====================================================================
-- Fase 1B — Evidências + Auditoria + Storage + Notificações
-- Arquivo : 0002_evidence_audit_storage.sql
-- Aplicar : APÓS 0001_foundation + 0001b_hotfix
-- Rollback: 0002_evidence_audit_storage_down.sql
-- =====================================================================

begin;
set check_function_bodies = off;

-- ---------------------------------------------------------------
-- 1. evidence_templates
-- ---------------------------------------------------------------
create table if not exists public.evidence_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  description     text,
  is_active       boolean not null default true,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists evidence_templates_org_idx on public.evidence_templates (organization_id);

-- ---------------------------------------------------------------
-- 2. evidence_template_fields
-- ---------------------------------------------------------------
create table if not exists public.evidence_template_fields (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id     uuid not null references public.evidence_templates(id) on delete cascade,
  label           text not null,
  field_type      text not null
                  check (field_type in ('text','number','date','boolean','file','textarea')),
  is_required     boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists evidence_template_fields_org_idx      on public.evidence_template_fields (organization_id);
create index if not exists evidence_template_fields_template_idx on public.evidence_template_fields (template_id);

-- ---------------------------------------------------------------
-- 3. task_evidences
--    Múltiplas evidências por tarefa (revisões após rejeição).
--    Sem UNIQUE em task_id.
-- ---------------------------------------------------------------
create table if not exists public.task_evidences (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  task_id          uuid not null references public.tasks(id) on delete cascade,
  template_id      uuid references public.evidence_templates(id) on delete set null,
  title            text not null,
  description      text,
  status           text not null default 'draft'
                   check (status in ('draft','submitted','approved','rejected')),
  submitted_by     uuid references public.profiles(id) on delete set null,
  submitted_at     timestamptz,
  reviewed_by      uuid references public.profiles(id) on delete set null,
  reviewed_at      timestamptz,
  rejection_reason text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists task_evidences_org_idx    on public.task_evidences (organization_id);
create index if not exists task_evidences_task_idx   on public.task_evidences (task_id);
create index if not exists task_evidences_status_idx on public.task_evidences (status);

-- ---------------------------------------------------------------
-- 4. task_evidence_values
-- ---------------------------------------------------------------
create table if not exists public.task_evidence_values (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_id     uuid not null references public.task_evidences(id) on delete cascade,
  field_id        uuid not null references public.evidence_template_fields(id) on delete cascade,
  value_text      text,
  value_number    numeric,
  value_date      date,
  value_boolean   boolean,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint task_evidence_values_unique unique (evidence_id, field_id)
);

create index if not exists task_evidence_values_org_idx      on public.task_evidence_values (organization_id);
create index if not exists task_evidence_values_evidence_idx on public.task_evidence_values (evidence_id);

-- ---------------------------------------------------------------
-- 5. attachments
-- ---------------------------------------------------------------
create table if not exists public.attachments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence_id     uuid references public.task_evidences(id) on delete cascade,
  bucket          text not null
                  check (bucket in ('task-evidence','project-documents','project-manuals')),
  storage_path    text not null,
  file_name       text not null,
  file_size       bigint,
  mime_type       text,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint attachments_path_unique unique (bucket, storage_path)
);

create index if not exists attachments_org_idx      on public.attachments (organization_id);
create index if not exists attachments_evidence_idx on public.attachments (evidence_id);

-- ---------------------------------------------------------------
-- 6. notifications
-- ---------------------------------------------------------------
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  type            text not null,
  title           text not null,
  body            text,
  entity_type     text,
  entity_id       uuid,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists notifications_org_idx    on public.notifications (organization_id);
create index if not exists notifications_user_idx   on public.notifications (user_id);
create index if not exists notifications_unread_idx on public.notifications (user_id, read_at)
  where read_at is null;

-- ---------------------------------------------------------------
-- 7. audit_logs (imutável — sem updated_at)
-- ---------------------------------------------------------------
create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete set null,
  action          text not null
                  check (action in ('create','update','delete','login',
                                    'approve','reject','submit','assign')),
  entity_type     text not null,
  entity_id       uuid,
  old_value       jsonb,
  new_value       jsonb,
  ip_address      text,
  created_at      timestamptz not null default now()
);

create index if not exists audit_logs_org_idx    on public.audit_logs (organization_id);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_user_idx   on public.audit_logs (user_id);

-- ---------------------------------------------------------------
-- 8. Storage — buckets (privados)
--    Só cria se não existir; idempotente.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('task-evidence',      'task-evidence',      false, 52428800,
   array['image/jpeg','image/png','image/webp','application/pdf',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'text/plain']),
  ('project-documents',  'project-documents',  false, 52428800,
   array['application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'text/plain']),
  ('project-manuals',    'project-manuals',    false, 52428800,
   array['application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'text/plain'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- 9. Storage RLS — policies por path (organização isolada por prefixo)
--    Formato do path: {organization_id}/{project_id}/{...}
-- ---------------------------------------------------------------

drop policy if exists "task_evidence_select" on storage.objects;
drop policy if exists "task_evidence_insert" on storage.objects;
drop policy if exists "task_evidence_delete" on storage.objects;
drop policy if exists "project_documents_select" on storage.objects;
drop policy if exists "project_documents_insert" on storage.objects;
drop policy if exists "project_documents_delete" on storage.objects;
drop policy if exists "project_manuals_select" on storage.objects;
drop policy if exists "project_manuals_insert" on storage.objects;
drop policy if exists "project_manuals_delete" on storage.objects;

-- task-evidence
create policy "task_evidence_select" on storage.objects
  for select using (
    bucket_id = 'task-evidence'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "task_evidence_insert" on storage.objects
  for insert with check (
    bucket_id = 'task-evidence'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_role() in ('admin','manager','consultant')
  );

create policy "task_evidence_delete" on storage.objects
  for delete using (
    bucket_id = 'task-evidence'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_role() in ('admin','manager')
  );

-- project-documents
create policy "project_documents_select" on storage.objects
  for select using (
    bucket_id = 'project-documents'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "project_documents_insert" on storage.objects
  for insert with check (
    bucket_id = 'project-documents'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_role() in ('admin','manager')
  );

create policy "project_documents_delete" on storage.objects
  for delete using (
    bucket_id = 'project-documents'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_role() in ('admin','manager')
  );

-- project-manuals
create policy "project_manuals_select" on storage.objects
  for select using (
    bucket_id = 'project-manuals'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "project_manuals_insert" on storage.objects
  for insert with check (
    bucket_id = 'project-manuals'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_role() in ('admin','manager')
  );

create policy "project_manuals_delete" on storage.objects
  for delete using (
    bucket_id = 'project-manuals'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_role() in ('admin','manager')
  );

-- ---------------------------------------------------------------
-- 10. Triggers updated_at (reutiliza set_updated_at() da 0001)
-- ---------------------------------------------------------------
drop trigger if exists trg_evidence_templates_updated_at  on public.evidence_templates;
drop trigger if exists trg_task_evidences_updated_at      on public.task_evidences;
drop trigger if exists trg_task_evidence_values_updated_at on public.task_evidence_values;

create trigger trg_evidence_templates_updated_at
  before update on public.evidence_templates
  for each row execute function public.set_updated_at();

create trigger trg_task_evidences_updated_at
  before update on public.task_evidences
  for each row execute function public.set_updated_at();

create trigger trg_task_evidence_values_updated_at
  before update on public.task_evidence_values
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- 11. Trigger tenancy set_org_id para novas tabelas
-- ---------------------------------------------------------------
drop trigger if exists trg_evidence_templates_org_id       on public.evidence_templates;
drop trigger if exists trg_evidence_template_fields_org_id on public.evidence_template_fields;
drop trigger if exists trg_task_evidences_org_id           on public.task_evidences;
drop trigger if exists trg_task_evidence_values_org_id     on public.task_evidence_values;
drop trigger if exists trg_attachments_org_id              on public.attachments;
drop trigger if exists trg_notifications_org_id            on public.notifications;
drop trigger if exists trg_audit_logs_org_id               on public.audit_logs;

create trigger trg_evidence_templates_org_id
  before insert on public.evidence_templates
  for each row execute function public.set_org_id();

create trigger trg_evidence_template_fields_org_id
  before insert on public.evidence_template_fields
  for each row execute function public.set_org_id();

create trigger trg_task_evidences_org_id
  before insert on public.task_evidences
  for each row execute function public.set_org_id();

create trigger trg_task_evidence_values_org_id
  before insert on public.task_evidence_values
  for each row execute function public.set_org_id();

create trigger trg_attachments_org_id
  before insert on public.attachments
  for each row execute function public.set_org_id();

create trigger trg_notifications_org_id
  before insert on public.notifications
  for each row execute function public.set_org_id();

create trigger trg_audit_logs_org_id
  before insert on public.audit_logs
  for each row execute function public.set_org_id();

-- ---------------------------------------------------------------
-- 12. Function: criar notificação (SECURITY DEFINER)
--     Usada pelos triggers abaixo. Não falha silenciosamente.
-- ---------------------------------------------------------------
create or replace function public.create_notification(
  p_organization_id uuid,
  p_user_id         uuid,
  p_type            text,
  p_title           text,
  p_body            text    default null,
  p_entity_type     text    default null,
  p_entity_id       uuid    default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_organization_id is null then return; end if;
  insert into public.notifications
    (organization_id, user_id, type, title, body, entity_type, entity_id)
  values
    (p_organization_id, p_user_id, p_type, p_title, p_body, p_entity_type, p_entity_id);
end;
$$;

-- ---------------------------------------------------------------
-- 13. Trigger: notificação ao atribuir tarefa
-- ---------------------------------------------------------------
create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nova atribuição ou mudança de responsável
  if new.assignee_id is not null
     and new.assignee_id is distinct from old.assignee_id then
    perform public.create_notification(
      new.organization_id,
      new.assignee_id,
      'task_assigned',
      'Tarefa atribuída: ' || new.title,
      'Você foi designado(a) para a tarefa "' || new.title || '".',
      'task',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_notify_assignment on public.tasks;
create trigger trg_tasks_notify_assignment
  after update on public.tasks
  for each row execute function public.notify_task_assignment();

-- Também na inserção de nova tarefa já com assignee
create or replace function public.notify_task_assignment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assignee_id is not null then
    perform public.create_notification(
      new.organization_id,
      new.assignee_id,
      'task_assigned',
      'Tarefa atribuída: ' || new.title,
      'Você foi designado(a) para a tarefa "' || new.title || '".',
      'task',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_notify_assignment_insert on public.tasks;
create trigger trg_tasks_notify_assignment_insert
  after insert on public.tasks
  for each row execute function public.notify_task_assignment_insert();

-- ---------------------------------------------------------------
-- 14. Function: log de auditoria genérico (SECURITY DEFINER)
-- ---------------------------------------------------------------
create or replace function public.create_audit_log(
  p_organization_id uuid,
  p_user_id         uuid,
  p_action          text,
  p_entity_type     text,
  p_entity_id       uuid    default null,
  p_old_value       jsonb   default null,
  p_new_value       jsonb   default null,
  p_ip_address      text    default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs
    (organization_id, user_id, action, entity_type, entity_id,
     old_value, new_value, ip_address)
  values
    (p_organization_id, p_user_id, p_action, p_entity_type, p_entity_id,
     p_old_value, p_new_value, p_ip_address);
end;
$$;

-- ---------------------------------------------------------------
-- 15. Trigger: audit_logs para mudanças críticas em projects e tasks
-- ---------------------------------------------------------------
create or replace function public.log_project_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.create_audit_log(
      old.organization_id, auth.uid(),
      'update', 'project', old.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;
  if new.manager_id is distinct from old.manager_id then
    perform public.create_audit_log(
      old.organization_id, auth.uid(),
      'update', 'project', old.id,
      jsonb_build_object('manager_id', old.manager_id),
      jsonb_build_object('manager_id', new.manager_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projects_audit on public.projects;
create trigger trg_projects_audit
  after update on public.projects
  for each row execute function public.log_project_change();

create or replace function public.log_task_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.create_audit_log(
      old.organization_id, auth.uid(),
      'update', 'task', old.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    perform public.create_audit_log(
      old.organization_id, auth.uid(),
      case when new.assignee_id is not null then 'assign' else 'update' end,
      'task', old.id,
      jsonb_build_object('assignee_id', old.assignee_id),
      jsonb_build_object('assignee_id', new.assignee_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_audit on public.tasks;
create trigger trg_tasks_audit
  after update on public.tasks
  for each row execute function public.log_task_audit();

-- ---------------------------------------------------------------
-- 16. RLS — habilitar + policies
-- ---------------------------------------------------------------

-- evidence_templates
alter table public.evidence_templates enable row level security;

create policy evidence_templates_select on public.evidence_templates
  for select using (organization_id = public.current_org_id());

create policy evidence_templates_insert on public.evidence_templates
  for insert with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));

create policy evidence_templates_update on public.evidence_templates
  for update using (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'))
  with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));

create policy evidence_templates_delete on public.evidence_templates
  for delete using (organization_id = public.current_org_id()
    and public.current_role() = 'admin');

-- evidence_template_fields
alter table public.evidence_template_fields enable row level security;

create policy evidence_template_fields_select on public.evidence_template_fields
  for select using (organization_id = public.current_org_id());

create policy evidence_template_fields_insert on public.evidence_template_fields
  for insert with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));

create policy evidence_template_fields_update on public.evidence_template_fields
  for update using (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'))
  with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));

create policy evidence_template_fields_delete on public.evidence_template_fields
  for delete using (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));

-- task_evidences
alter table public.task_evidences enable row level security;

create policy task_evidences_select on public.task_evidences
  for select using (organization_id = public.current_org_id());

create policy task_evidences_insert on public.task_evidences
  for insert with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager','consultant'));

create policy task_evidences_update on public.task_evidences
  for update using (organization_id = public.current_org_id()
    and (public.current_role() in ('admin','manager')
         or submitted_by = auth.uid()
         or created_by  = auth.uid()))
  with check (organization_id = public.current_org_id()
    and (public.current_role() in ('admin','manager')
         or submitted_by = auth.uid()
         or created_by  = auth.uid()));

create policy task_evidences_delete on public.task_evidences
  for delete using (organization_id = public.current_org_id()
    and public.current_role() = 'admin');

-- task_evidence_values
alter table public.task_evidence_values enable row level security;

create policy task_evidence_values_select on public.task_evidence_values
  for select using (organization_id = public.current_org_id());

create policy task_evidence_values_insert on public.task_evidence_values
  for insert with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager','consultant'));

create policy task_evidence_values_update on public.task_evidence_values
  for update using (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager','consultant'))
  with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager','consultant'));

create policy task_evidence_values_delete on public.task_evidence_values
  for delete using (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager'));

-- attachments
alter table public.attachments enable row level security;

create policy attachments_select on public.attachments
  for select using (organization_id = public.current_org_id());

create policy attachments_insert on public.attachments
  for insert with check (organization_id = public.current_org_id()
    and public.current_role() in ('admin','manager','consultant'));

create policy attachments_delete on public.attachments
  for delete using (organization_id = public.current_org_id()
    and (uploaded_by = auth.uid()
         or public.current_role() in ('admin','manager')));

-- notifications: isolado por user_id dentro da org
alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
  for select using (organization_id = public.current_org_id()
    and user_id = auth.uid());

create policy notifications_update on public.notifications
  for update using (organization_id = public.current_org_id()
    and user_id = auth.uid())
  with check (organization_id = public.current_org_id()
    and user_id = auth.uid());

create policy notifications_delete on public.notifications
  for delete using (organization_id = public.current_org_id()
    and user_id = auth.uid());

-- audit_logs: somente leitura (escrita só via SECURITY DEFINER)
alter table public.audit_logs enable row level security;

create policy audit_logs_select on public.audit_logs
  for select using (organization_id = public.current_org_id());

-- ---------------------------------------------------------------
-- 17. Grants explícitos
-- ---------------------------------------------------------------
grant select, insert, update, delete on
  public.evidence_templates, public.evidence_template_fields,
  public.task_evidences, public.task_evidence_values,
  public.attachments, public.notifications
to authenticated;

grant select on public.audit_logs to authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;
revoke insert, update, delete on public.notifications from authenticated;

grant execute on function public.create_notification(uuid,uuid,text,text,text,text,uuid) to authenticated;
grant execute on function public.create_audit_log(uuid,uuid,text,text,uuid,jsonb,jsonb,text) to authenticated;

commit;
