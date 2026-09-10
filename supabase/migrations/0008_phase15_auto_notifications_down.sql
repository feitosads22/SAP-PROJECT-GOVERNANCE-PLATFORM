-- Rollback da Fase 15 — Notificações Automáticas

begin;

select cron.unschedule(jobid) from cron.job where jobname = 'phase15-daily-notifications';

drop trigger if exists trg_timesheets_notify_rejection on public.timesheets;
drop function if exists public.notify_timesheet_rejected();

drop trigger if exists trg_cr_notify_status on public.change_requests;
drop function if exists public.notify_cr_status_change();

drop function if exists public.notify_milestones_due_soon();
drop function if exists public.notify_tasks_overdue();
drop function if exists public.notify_tasks_due_soon();

commit;
