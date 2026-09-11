-- Fase 18 — Upload de foto de perfil
-- Cria o bucket "avatars" (público para leitura) com policies por usuário.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

-- Cada usuário só pode enviar/atualizar/excluir seu próprio arquivo
-- (convenção: nome do arquivo = "<user_id>/qualquer-coisa.ext")
drop policy if exists avatars_own_insert on storage.objects;
create policy avatars_own_insert on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_own_update on storage.objects;
create policy avatars_own_update on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_own_delete on storage.objects;
create policy avatars_own_delete on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
