-- =====================================================================
-- Testes Fase 2 — Workflow + Evidências
-- Rodar após: 0001 + 0001b + seed + 0002 + 0003
-- Termina em ROLLBACK. Qualquer assert falho aborta com FAIL Cn.
-- =====================================================================

begin;
set local role authenticated;

-- -----------------------------------------------------------------------
-- C1: tarefa com requires_evidence=true não pode ser concluída sem
--     evidência aprovada — o trigger deve barrar
-- -----------------------------------------------------------------------
do $$
declare ok bool := false; tid uuid;
begin
  -- pega tarefa que exige evidência
  set local role postgres;
  select id into tid from public.tasks
   where organization_id = '11111111-1111-1111-1111-111111111111'
     and requires_evidence = true
   limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);

  begin
    update public.tasks set status = 'completed' where id = tid;
  exception when others then
    ok := sqlerrm like '%EVIDENCE_REQUIRED%';
  end;
  assert ok, 'FAIL C1';
end $$;

-- -----------------------------------------------------------------------
-- C2: tarefa sem requires_evidence pode ser concluída diretamente
-- -----------------------------------------------------------------------
do $$
declare n int; tid uuid;
begin
  set local role postgres;
  select id into tid from public.tasks
   where organization_id = '11111111-1111-1111-1111-111111111111'
     and requires_evidence = false
   limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);

  update public.tasks set status = 'completed' where id = tid;
  get diagnostics n = row_count;
  assert n = 1, 'FAIL C2';

  -- restaura
  update public.tasks set status = 'todo' where id = tid;
end $$;

-- -----------------------------------------------------------------------
-- C3: com evidência aprovada, tarefa com requires_evidence pode concluir
-- -----------------------------------------------------------------------
do $$
declare n int; tid uuid; ev_id uuid;
begin
  set local role postgres;
  select id into tid from public.tasks
   where organization_id = '11111111-1111-1111-1111-111111111111'
     and requires_evidence = true
   limit 1;

  -- cria e aprova evidência como postgres (bypassa RLS intencionalmente)
  insert into public.task_evidences
    (organization_id, task_id, title, status, created_by,
     submitted_by, submitted_at, reviewed_by, reviewed_at)
  values
    ('11111111-1111-1111-1111-111111111111', tid,
     'Evidência C3', 'approved',
     'aaaaaaaa-0000-0000-0000-000000000003',
     'aaaaaaaa-0000-0000-0000-000000000003', now(),
     'aaaaaaaa-0000-0000-0000-000000000002', now())
  returning id into ev_id;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);

  update public.tasks set status = 'completed' where id = tid;
  get diagnostics n = row_count;
  assert n = 1, 'FAIL C3';

  -- restaura
  set local role postgres;
  delete from public.task_evidences where id = ev_id;
  update public.tasks set status = 'in_progress' where id = tid;
end $$;

-- -----------------------------------------------------------------------
-- C4: kanban — consultant move própria tarefa de in_progress → blocked
-- -----------------------------------------------------------------------
do $$
declare n int; tid uuid;
begin
  set local role postgres;
  select id into tid from public.tasks
   where organization_id = '11111111-1111-1111-1111-111111111111'
     and assignee_id = 'aaaaaaaa-0000-0000-0000-000000000003'
   limit 1;
  update public.tasks set status = 'in_progress' where id = tid;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);

  update public.tasks set status = 'blocked' where id = tid;
  get diagnostics n = row_count;
  assert n = 1, 'FAIL C4';
end $$;

-- -----------------------------------------------------------------------
-- C5: customer não move tarefa no kanban
-- -----------------------------------------------------------------------
do $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}',true);

  update public.tasks set status = 'completed'
   where organization_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  assert n = 0, 'FAIL C5';
end $$;

-- -----------------------------------------------------------------------
-- C6: submeter evidência notifica o reviewer
-- -----------------------------------------------------------------------
do $$
declare cnt_antes int; cnt_depois int; ev_id uuid; tid uuid;
begin
  set local role postgres;
  select id into tid from public.tasks
   where organization_id = '11111111-1111-1111-1111-111111111111'
     and reviewer_id = 'aaaaaaaa-0000-0000-0000-000000000002'
   limit 1;

  insert into public.task_evidences
    (organization_id, task_id, title, status, created_by)
  values
    ('11111111-1111-1111-1111-111111111111', tid,
     'Evidência C6', 'draft',
     'aaaaaaaa-0000-0000-0000-000000000003')
  returning id into ev_id;

  select count(*) into cnt_antes from public.notifications
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000002'
     and type = 'evidence_submitted';

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);

  update public.task_evidences
     set status = 'submitted', submitted_by = 'aaaaaaaa-0000-0000-0000-000000000003',
         submitted_at = now()
   where id = ev_id;

  set local role postgres;
  select count(*) into cnt_depois from public.notifications
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000002'
     and type = 'evidence_submitted';

  assert cnt_depois > cnt_antes, 'FAIL C6';
end $$;

-- -----------------------------------------------------------------------
-- C7: rejeitar evidência notifica o criador
-- -----------------------------------------------------------------------
do $$
declare cnt_antes int; cnt_depois int; ev_id uuid; tid uuid;
begin
  set local role postgres;
  select id into tid from public.tasks
   where organization_id = '11111111-1111-1111-1111-111111111111'
   limit 1;

  insert into public.task_evidences
    (organization_id, task_id, title, status, created_by,
     submitted_by, submitted_at)
  values
    ('11111111-1111-1111-1111-111111111111', tid,
     'Evidência C7', 'submitted',
     'aaaaaaaa-0000-0000-0000-000000000003',
     'aaaaaaaa-0000-0000-0000-000000000003', now())
  returning id into ev_id;

  select count(*) into cnt_antes from public.notifications
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000003'
     and type = 'evidence_rejected';

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);

  update public.task_evidences
     set status = 'rejected',
         reviewed_by = 'aaaaaaaa-0000-0000-0000-000000000002',
         reviewed_at = now(),
         rejection_reason = 'Faltou anexar o print'
   where id = ev_id;

  set local role postgres;
  select count(*) into cnt_depois from public.notifications
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000003'
     and type = 'evidence_rejected';

  assert cnt_depois > cnt_antes, 'FAIL C7';
end $$;

-- -----------------------------------------------------------------------
-- C8: audit_log registrado ao aprovar evidência
-- -----------------------------------------------------------------------
do $$
declare cnt int; ev_id uuid; tid uuid;
begin
  set local role postgres;
  select id into tid from public.tasks
   where organization_id = '11111111-1111-1111-1111-111111111111'
   limit 1;

  insert into public.task_evidences
    (organization_id, task_id, title, status, created_by,
     submitted_by, submitted_at)
  values
    ('11111111-1111-1111-1111-111111111111', tid,
     'Evidência C8', 'submitted',
     'aaaaaaaa-0000-0000-0000-000000000003',
     'aaaaaaaa-0000-0000-0000-000000000003', now())
  returning id into ev_id;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);

  update public.task_evidences
     set status = 'approved',
         reviewed_by = 'aaaaaaaa-0000-0000-0000-000000000002',
         reviewed_at = now()
   where id = ev_id;

  set local role postgres;
  select count(*) into cnt from public.audit_logs
   where entity_type = 'evidence'
     and entity_id   = ev_id
     and action      = 'approve';

  assert cnt = 1, 'FAIL C8';
end $$;

-- resultado
select t as teste, 'PASS' as r
from unnest(array[
  'C1  tarefa c/ evidência obrig. bloqueada sem approved',
  'C2  tarefa sem evidência obrig. conclui normalmente',
  'C3  tarefa conclui após evidência aprovada',
  'C4  consultant move própria tarefa no kanban',
  'C5  customer não move tarefa',
  'C6  submissão notifica reviewer',
  'C7  rejeição notifica criador',
  'C8  aprovação grava audit_log'
]) t;

rollback;
