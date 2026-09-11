-- =====================================================================
-- Trava a movimentação de uma tarefa PARA FORA da fase "Validação"
-- enquanto a evidência não for aprovada pelo gerente/admin.
--
-- O trigger antigo (check_evidence_before_completion) só validava a
-- transição para 'completed'. Isso deixava um buraco: uma tarefa em
-- 'validation' podia voltar pro kanban (ex: 'in_progress') sem que
-- ninguém aprovasse ou rejeitasse a evidência formalmente. Agora
-- QUALQUER saída de 'validation' exige uma evidência aprovada, quando
-- a tarefa exige evidência.
-- =====================================================================

create or replace function public.check_evidence_before_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  approved_count int;
begin
  if new.requires_evidence = true
     and old.status = 'validation'
     and new.status is distinct from 'validation' then

    select count(*) into approved_count
      from public.task_evidences
     where task_id = new.id
       and status  = 'approved';

    if approved_count = 0 then
      raise exception
        'EVIDENCE_REQUIRED: tarefa "%" exige evidência aprovada pelo gerente antes de sair da Validação.',
        new.title
        using errcode = 'P0001';
    end if;
  end if;

  -- mantém a checagem original, para o caso raro de pular direto pra
  -- 'completed' sem nunca ter passado por 'validation'.
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
