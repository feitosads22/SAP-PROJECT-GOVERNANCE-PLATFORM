-- =====================================================================
-- Fase 2 — Execução + Workflow + Evidências
-- Arquivo : 0003_execution_workflow.sql
-- Aplicar : APÓS 0002_evidence_audit_storage
-- Rollback: 0003_execution_workflow_down.sql
-- =====================================================================

begin;
set check_function_bodies = off;

-- ---------------------------------------------------------------
-- 1. Trigger: impede conclusão de tarefa sem evidência aprovada.
--    Regra: se requires_evidence = true e novo status = 'completed',
--    deve existir ao menos uma task_evidence com status = 'approved'
--    para essa tarefa.
--    Validado no banco — não pode ser contornado pelo frontend.
-- ---------------------------------------------------------------
create or replace function public.check_evidence_before_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  approved_count int;
begin
  -- só valida na transição para 'completed'
  if new.status = 'completed'
     and (old.status is distinct from 'completed')
     and new.requires_evidence = true then

    select count(*) into approved_count
      from public.task_evidences
     where task_id = new.id
       and status  = 'approved';

    if approved_count = 0 then
      raise exception
        'EVIDENCE_REQUIRED: tarefa "%" exige evidência aprovada antes de ser concluída.',
        new.title
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_check_evidence on public.tasks;
create trigger trg_tasks_check_evidence
  before update on public.tasks
  for each row execute function public.check_evidence_before_completion();

-- ---------------------------------------------------------------
-- 2. Trigger: ao aprovar evidência, registra audit_log
-- ---------------------------------------------------------------
create or replace function public.log_evidence_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('approved','rejected')
     and old.status is distinct from new.status then
    perform public.create_audit_log(
      old.organization_id,
      auth.uid(),
      case new.status when 'approved' then 'approve' else 'reject' end,
      'evidence',
      old.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status,
                         'rejection_reason', new.rejection_reason)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_evidences_audit on public.task_evidences;
create trigger trg_task_evidences_audit
  after update on public.task_evidences
  for each row execute function public.log_evidence_review();

-- ---------------------------------------------------------------
-- 3. Trigger: notificação ao submeter evidência para revisão
-- ---------------------------------------------------------------
create or replace function public.notify_evidence_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer uuid;
  v_task_title text;
begin
  if new.status = 'submitted' and old.status = 'draft' then
    -- notifica o reviewer da tarefa
    select reviewer_id, title
      into v_reviewer, v_task_title
      from public.tasks
     where id = new.task_id;

    if v_reviewer is not null then
      perform public.create_notification(
        new.organization_id, v_reviewer,
        'evidence_submitted',
        'Evidência aguardando validação: ' || coalesce(v_task_title,''),
        'A evidência "' || new.title || '" foi submetida para sua revisão.',
        'evidence', new.id
      );
    end if;
  end if;

  -- notifica o criador quando aprovado ou rejeitado
  if new.status in ('approved','rejected')
     and old.status is distinct from new.status then
    if new.created_by is not null then
      perform public.create_notification(
        new.organization_id, new.created_by,
        case new.status when 'approved' then 'evidence_approved'
                        else 'evidence_rejected' end,
        case new.status when 'approved' then 'Evidência aprovada: '
                        else 'Evidência rejeitada: ' end || new.title,
        case new.status when 'rejected'
          then 'Motivo: ' || coalesce(new.rejection_reason,'não informado')
          else null end,
        'evidence', new.id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_task_evidences_notify on public.task_evidences;
create trigger trg_task_evidences_notify
  after update on public.task_evidences
  for each row execute function public.notify_evidence_submitted();

-- ---------------------------------------------------------------
-- 4. Índices adicionais para as queries do frontend de Fase 2
-- ---------------------------------------------------------------

-- kanban: busca por projeto + status
create index if not exists tasks_project_status_idx
  on public.tasks (project_id, status);

-- "minhas tarefas": assignee + status + updated_at
create index if not exists tasks_assignee_status_idx
  on public.tasks (assignee_id, status, updated_at desc);

-- evidências por tarefa + status
create index if not exists task_evidences_task_status_idx
  on public.task_evidences (task_id, status);

-- notificações não lidas por usuário (já existe parcial em 0002,
-- mas adicionamos cobertura de created_at para ordenação)
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- audit_log por entidade + data (consultas de histórico)
create index if not exists audit_logs_entity_created_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------
-- 5. Corrige o check constraint de audit_logs.action para incluir
--    'approve' e 'reject' (usados pelo trigger de evidência acima).
--    A 0002 já tinha 'approve' e 'reject' — apenas garantindo.
-- ---------------------------------------------------------------
-- (sem ALTER necessário: o check já inclui esses valores na 0002)

commit;
