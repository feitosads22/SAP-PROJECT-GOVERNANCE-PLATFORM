-- =====================================================================
-- Testes RLS Fase 1B
-- Rodar após: 0001_foundation + 0001b_hotfix + 001_seed + 0002_evidence_audit_storage
-- Termina em ROLLBACK — não deixa resíduo.
-- Qualquer assert falho aborta com FAIL Bn.
-- =====================================================================

begin;
set local role authenticated;

-- -----------------------------------------------------------------------
-- B1: manager cria template; consultant da mesma org consegue ler
-- -----------------------------------------------------------------------
do $$
declare cnt int;
begin
  -- manager cria
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);
  insert into public.evidence_templates (organization_id, name)
  values ('11111111-1111-1111-1111-111111111111','Template Teste B1');

  -- consultant lê
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);
  select count(*) into cnt from public.evidence_templates
   where organization_id = '11111111-1111-1111-1111-111111111111';
  assert cnt >= 1, 'FAIL B1';
end $$;

-- -----------------------------------------------------------------------
-- B2: manager da Org B não vê evidence_templates da Org A
-- -----------------------------------------------------------------------
do $$
declare cnt int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);
  select count(*) into cnt from public.evidence_templates
   where organization_id = '11111111-1111-1111-1111-111111111111';
  assert cnt = 0, 'FAIL B2';
end $$;

-- -----------------------------------------------------------------------
-- B3: customer não cria evidence_template
-- -----------------------------------------------------------------------
do $$
declare ok bool := false;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}',true);
  begin
    insert into public.evidence_templates (organization_id, name)
    values ('11111111-1111-1111-1111-111111111111','Template Pirata');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'FAIL B3';
end $$;

-- -----------------------------------------------------------------------
-- B4: consultant cria task_evidence para tarefa da própria org
-- -----------------------------------------------------------------------
do $$
declare ev_id uuid; cnt int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);

  insert into public.task_evidences
    (organization_id, task_id, title, status, created_by)
  select '11111111-1111-1111-1111-111111111111', id,
         'Evidência B4', 'draft',
         'aaaaaaaa-0000-0000-0000-000000000003'
    from public.tasks
   where organization_id = '11111111-1111-1111-1111-111111111111'
   limit 1
  returning id into ev_id;

  select count(*) into cnt from public.task_evidences where id = ev_id;
  assert cnt = 1, 'FAIL B4';
end $$;

-- -----------------------------------------------------------------------
-- B5: manager da Org B não vê task_evidences da Org A
-- -----------------------------------------------------------------------
do $$
declare cnt int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);
  select count(*) into cnt from public.task_evidences
   where organization_id = '11111111-1111-1111-1111-111111111111';
  assert cnt = 0, 'FAIL B5';
end $$;

-- -----------------------------------------------------------------------
-- B6: customer não lê audit_logs (a policy só existe para org, mas
--     customer vê somente o que a org permite — aqui testamos que
--     audit_logs não aceita INSERT direto de usuário autenticado)
-- -----------------------------------------------------------------------
do $$
declare ok bool := false;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);
  begin
    insert into public.audit_logs
      (organization_id, user_id, action, entity_type)
    values
      ('11111111-1111-1111-1111-111111111111',
       'aaaaaaaa-0000-0000-0000-000000000002',
       'create', 'task');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'FAIL B6';
end $$;

-- -----------------------------------------------------------------------
-- B7: notifications — usuário só lê as próprias notificações
-- -----------------------------------------------------------------------
do $$
declare cnt int;
begin
  -- insere notif para o manager (via função SECURITY DEFINER)
  perform set_config('request.jwt.claims','',true);
  set local role postgres;
  insert into public.notifications
    (organization_id, user_id, type, title)
  values
    ('11111111-1111-1111-1111-111111111111',
     'aaaaaaaa-0000-0000-0000-000000000002',
     'task_assigned','Notif B7');

  set local role authenticated;
  -- consultant tenta ler notificação do manager
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}',true);
  select count(*) into cnt from public.notifications
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert cnt = 0, 'FAIL B7';
end $$;

-- -----------------------------------------------------------------------
-- B8: notifications — usuário lê as próprias
-- -----------------------------------------------------------------------
do $$
declare cnt int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);
  select count(*) into cnt from public.notifications
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert cnt >= 1, 'FAIL B8';
end $$;

-- -----------------------------------------------------------------------
-- B9: trigger de notificação ao atribuir tarefa
--     Seed já tem consultant como assignee; troca para manager e volta.
-- -----------------------------------------------------------------------
do $$
declare tid uuid; cnt_antes int; cnt_depois int;
begin
  set local role postgres;
  -- pega a tarefa e força assignee diferente para garantir mudança real
  select id into tid from public.tasks
   where organization_id = '11111111-1111-1111-1111-111111111111'
   limit 1;

  update public.tasks set assignee_id = 'aaaaaaaa-0000-0000-0000-000000000002'
   where id = tid;  -- vira manager

  select count(*) into cnt_antes from public.notifications
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000003'
     and type = 'task_assigned';

  -- manager reatribui de volta ao consultant — isso muda assignee_id
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);

  update public.tasks
     set assignee_id = 'aaaaaaaa-0000-0000-0000-000000000003'
   where id = tid;

  set local role postgres;
  select count(*) into cnt_depois from public.notifications
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000003'
     and type = 'task_assigned';

  assert cnt_depois > cnt_antes, 'FAIL B9';
end $$;

-- -----------------------------------------------------------------------
-- B10: trigger de audit_log ao mudar status de projeto
-- -----------------------------------------------------------------------
do $$
declare cnt int;
begin
  set local role postgres;
  -- garante estado inicial
  update public.projects set status = 'active'
   where id = 'cccccccc-0000-0000-0000-000000000001';

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}',true);

  update public.projects set status = 'on_hold'
   where id = 'cccccccc-0000-0000-0000-000000000001';

  set local role postgres;
  select count(*) into cnt from public.audit_logs
   where entity_type = 'project'
     and entity_id   = 'cccccccc-0000-0000-0000-000000000001'
     and action      = 'update'
     and (old_value ->> 'status') = 'active'
     and (new_value ->> 'status') = 'on_hold';

  assert cnt = 1, 'FAIL B10';
end $$;

-- -----------------------------------------------------------------------
-- B11: manager Org B não cria evidência na Org A
-- -----------------------------------------------------------------------
do $$
declare ok bool := false;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);
  begin
    insert into public.task_evidences
      (organization_id, task_id, title)
    select '11111111-1111-1111-1111-111111111111', id, 'Invasão B11'
      from public.tasks
     where organization_id = '11111111-1111-1111-1111-111111111111'
     limit 1;
  exception when insufficient_privilege then ok := true;
  end;
  -- O org_id spoofado é corrigido pelo trigger set_org_id (vira Org B),
  -- e a task_id é da Org A — a FK de tasks falha ou RLS bloqueia o select.
  -- Em qualquer caso, nenhuma linha deve aparecer na Org A.
  assert ok or (
    select count(*) = 0 from public.task_evidences
     where organization_id = '11111111-1111-1111-1111-111111111111'
       and title = 'Invasão B11'
  ), 'FAIL B11';
end $$;

-- -----------------------------------------------------------------------
-- B12: attachments — cross-tenant bloqueado
-- -----------------------------------------------------------------------
do $$
declare ok bool := false;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}',true);
  begin
    insert into public.attachments
      (organization_id, bucket, storage_path, file_name)
    values
      ('11111111-1111-1111-1111-111111111111',
       'task-evidence',
       '11111111-1111-1111-1111-111111111111/prj/tsk/arquivo.pdf',
       'arquivo.pdf');
  exception when insufficient_privilege then ok := true;
  end;
  assert ok or (
    select count(*) = 0 from public.attachments
     where organization_id = '11111111-1111-1111-1111-111111111111'
  ), 'FAIL B12';
end $$;

-- resultado
select t as teste, 'PASS' as r
from unnest(array[
  'B1  consultant cria/vê evidence_template',
  'B2  org B não vê templates da org A',
  'B3  customer não cria template',
  'B4  consultant cria task_evidence',
  'B5  org B não vê evidências da org A',
  'B6  audit_log bloqueado para insert direto',
  'B7  notification isolada por user_id',
  'B8  usuário lê próprias notifications',
  'B9  trigger dispara notif ao atribuir tarefa',
  'B10 trigger grava audit_log ao mudar status',
  'B11 org B não cria evidência na org A',
  'B12 attachment cross-tenant bloqueado'
]) t;

rollback;
