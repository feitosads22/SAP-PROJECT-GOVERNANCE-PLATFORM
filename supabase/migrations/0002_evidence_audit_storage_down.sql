-- =====================================================================
-- ROLLBACK de 0002_evidence_audit_storage.sql
-- Não apaga dados. Só remove estrutura criada nesta migration.
-- =====================================================================
begin;

drop trigger if exists trg_tasks_audit                    on public.tasks;
drop trigger if exists trg_tasks_notify_assignment        on public.tasks;
drop trigger if exists trg_tasks_notify_assignment_insert on public.tasks;
drop trigger if exists trg_projects_audit                 on public.projects;
drop trigger if exists trg_audit_logs_org_id              on public.audit_logs;
drop trigger if exists trg_notifications_org_id           on public.notifications;
drop trigger if exists trg_attachments_org_id             on public.attachments;
drop trigger if exists trg_task_evidence_values_org_id    on public.task_evidence_values;
drop trigger if exists trg_task_evidences_org_id          on public.task_evidences;
drop trigger if exists trg_evidence_template_fields_org_id on public.evidence_template_fields;
drop trigger if exists trg_evidence_templates_org_id      on public.evidence_templates;
drop trigger if exists trg_task_evidence_values_updated_at on public.task_evidence_values;
drop trigger if exists trg_task_evidences_updated_at      on public.task_evidences;
drop trigger if exists trg_evidence_templates_updated_at  on public.evidence_templates;

drop function if exists public.log_task_audit();
drop function if exists public.log_project_change();
drop function if exists public.notify_task_assignment_insert();
drop function if exists public.notify_task_assignment();
drop function if exists public.create_audit_log(uuid,uuid,text,text,uuid,jsonb,jsonb,text);
drop function if exists public.create_notification(uuid,uuid,text,text,text,text,uuid);

drop table if exists public.audit_logs            cascade;
drop table if exists public.notifications         cascade;
drop table if exists public.attachments           cascade;
drop table if exists public.task_evidence_values  cascade;
drop table if exists public.task_evidences        cascade;
drop table if exists public.evidence_template_fields cascade;
drop table if exists public.evidence_templates    cascade;

delete from storage.buckets
 where id in ('task-evidence','project-documents','project-manuals');

commit;
