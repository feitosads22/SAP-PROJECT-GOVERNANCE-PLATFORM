-- Fase 18 (correção) — handle_new_user() passa a ler organization_id/role
-- dos metadados enviados pela Edge Function invite-user, para o convidado
-- já entrar direto na organização de quem convidou, com o cargo certo.
-- Signup normal (sem metadados) continua com o comportamento antigo:
-- organization_id nulo e role 'pending' (vai para o Onboarding).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, organization_id, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid,
    coalesce(new.raw_user_meta_data ->> 'role', 'pending')
  );
  return new;
end;
$$;
