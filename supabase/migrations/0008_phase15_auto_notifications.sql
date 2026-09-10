-- Fase 15 — Notificações Automáticas
-- Requer a extensão pg_cron habilitada no projeto (Dashboard > Database > Extensions > pg_cron).
-- Se "create extension pg_cron" falhar por permissão, habilite pg_cron pela UI do Dashboard
-- primeiro e rode o restante deste script.

begin;

-- 1. Tarefa vencendo em 3 dias
create or replace function public.notify_tasks_due_soon()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select t.id, t.organization_id, t.assignee_id, t.title, t.due_date
    from public.tasks t
    where t.assignee_id is not null
      and t.due_date is not null
      and t.due_date = (current_date + interval '3 days')::date
      and t.status not in ('completed', 'cancelled')
      and not exists (
        select 1 from public.notifications n
        where n.entity_id = t.id and n.entity_type = 'task' and n.type = 'task_due_soon'
      )
  loop
    perform public.create_notification(
      r.organization_id, r.assignee_id, 'task_due_soon',
      'Tarefa vencendo em 3 dias: ' || r.title,
      'A tarefa "' || r.title || '" vence em ' || to_char(r.due_date, 'DD/MM/YYYY') || '.',
      'task', r.id
    );
  end loop;
end;
$$;

-- 2. Tarefa em atraso
create or replace function public.notify_tasks_overdue()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select t.id, t.organization_id, t.assignee_id, t.title, t.due_date
    from public.tasks t
    where t.assignee_id is not null
      and t.due_date is not null
      and t.due_date < current_date
      and t.status not in ('completed', 'cancelled')
      and not exists (
        select 1 from public.notifications n
        where n.entity_id = t.id and n.entity_type = 'task' and n.type = 'task_overdue'
      )
  loop
    perform public.create_notification(
      r.organization_id, r.assignee_id, 'task_overdue',
      'Tarefa em atraso: ' || r.title,
      'A tarefa "' || r.title || '" venceu em ' || to_char(r.due_date, 'DD/MM/YYYY') || ' e ainda não foi concluída.',
      'task', r.id
    );
  end loop;
end;
$$;

-- 3. Marco se aproximando (notifica admins/managers da organização do projeto)
create or replace function public.notify_milestones_due_soon()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_manager record;
begin
  for r in
    select m.id, m.organization_id, m.name, m.due_date
    from public.milestones m
    where m.due_date is not null
      and m.due_date = (current_date + interval '3 days')::date
      and m.status not in ('completed', 'cancelled')
      and not exists (
        select 1 from public.notifications n
        where n.entity_id = m.id and n.entity_type = 'milestone' and n.type = 'milestone_due_soon'
      )
  loop
    for v_manager in
      select id from public.profiles
      where organization_id = r.organization_id and role in ('admin', 'manager')
    loop
      perform public.create_notification(
        r.organization_id, v_manager.id, 'milestone_due_soon',
        'Marco se aproximando: ' || r.name,
        'O marco "' || r.name || '" está previsto para ' || to_char(r.due_date, 'DD/MM/YYYY') || '.',
        'milestone', r.id
      );
    end loop;
  end loop;
end;
$$;

-- 4. CR aprovado/rejeitado — trigger imediato (não depende do cron)
create or replace function public.notify_cr_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.requested_by is not null then
    if new.status = 'approved' then
      perform public.create_notification(
        new.organization_id, new.requested_by, 'cr_approved',
        'Change Request aprovada: ' || new.title,
        'Sua solicitação "' || new.title || '" foi aprovada.',
        'change_request', new.id
      );
    elsif new.status = 'rejected' then
      perform public.create_notification(
        new.organization_id, new.requested_by, 'cr_rejected',
        'Change Request rejeitada: ' || new.title,
        'Sua solicitação "' || new.title || '" foi rejeitada.' ||
          coalesce(' Motivo: ' || new.rejection_reason, ''),
        'change_request', new.id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cr_notify_status on public.change_requests;
create trigger trg_cr_notify_status
  after update on public.change_requests
  for each row execute function public.notify_cr_status_change();

-- 5. Timesheet rejeitado — trigger imediato
create or replace function public.notify_timesheet_rejected()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  if new.rejected_at is not null and old.rejected_at is null then
    select profile_id into v_profile_id from public.resources where id = new.resource_id;
    if v_profile_id is not null then
      perform public.create_notification(
        new.organization_id, v_profile_id, 'timesheet_rejected',
        'Apontamento de horas rejeitado',
        'Seu apontamento de ' || to_char(new.date, 'DD/MM/YYYY') || ' (' || new.hours::text || 'h) foi rejeitado.' ||
          coalesce(' Motivo: ' || new.rejection_reason, ''),
        'timesheet', new.id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_timesheets_notify_rejection on public.timesheets;
create trigger trg_timesheets_notify_rejection
  after update on public.timesheets
  for each row execute function public.notify_timesheet_rejected();

-- 6. Agendamento diário (pg_cron) para os checks baseados em data (tarefas/marcos)
create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid) from cron.job where jobname = 'phase15-daily-notifications';

select cron.schedule(
  'phase15-daily-notifications',
  '0 8 * * *',  -- todo dia às 08:00 UTC (~05:00 em Brasília)
  $$
    select public.notify_tasks_due_soon();
    select public.notify_tasks_overdue();
    select public.notify_milestones_due_soon();
  $$
);

-- 7. Realtime na tabela notifications (para o badge/centro de notificações ao vivo)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

grant execute on function public.notify_tasks_due_soon() to authenticated;
grant execute on function public.notify_tasks_overdue() to authenticated;
grant execute on function public.notify_milestones_due_soon() to authenticated;

commit;
