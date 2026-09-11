-- Cria o usuário ADMIN SISTEMA (dono do SaaS, gerencia todas as organizações/clientes)
-- IMPORTANTE: troque o e-mail e a senha assim que possível!
-- Login inicial: admin.sistema@saas-sap.internal / SapGov#2026!Trocar
-- Depois de logar, vá em "Meu Perfil" e troque a senha imediatamente.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
values (
  '00000000-0000-0000-0000-000000000000',
  '99999999-0000-0000-0000-000000000001',
  'authenticated','authenticated','admin.sistema@saas-sap.internal',
  crypt('SapGov#2026!Trocar', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}','{"full_name":"Admin Sistema"}',
  now(), now(), '', '', '', '')
on conflict (id) do nothing;

do $$
declare
  u record; has_provider_id boolean; has_id boolean; cols text; vals text;
begin
  select exists (select 1 from information_schema.columns where table_schema='auth' and table_name='identities' and column_name='provider_id') into has_provider_id;
  select exists (select 1 from information_schema.columns where table_schema='auth' and table_name='identities' and column_name='id') into has_id;

  for u in select id, email from auth.users where id = '99999999-0000-0000-0000-000000000001' loop
    if exists (select 1 from auth.identities where user_id = u.id and provider = 'email') then continue; end if;
    cols := 'user_id, identity_data, provider, last_sign_in_at, created_at, updated_at';
    vals := '$1, $2, ''email'', now(), now(), now()';
    if has_provider_id then cols := 'provider_id, ' || cols; vals := '$3, ' || vals; end if;
    if has_id then cols := 'id, ' || cols; vals := 'gen_random_uuid(), ' || vals; end if;
    if has_provider_id then
      execute format('insert into auth.identities (%s) values (%s)', cols, vals) using u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), u.id::text;
    else
      execute format('insert into auth.identities (%s) values (%s)', cols, vals) using u.id, jsonb_build_object('sub', u.id::text, 'email', u.email);
    end if;
  end loop;
end $$;

-- O profile é criado pelo trigger handle_new_user com organization_id nulo e
-- role 'pending' (padrão) — aqui promovemos para platform_admin, sem organização.
update public.profiles
set role = 'platform_admin', organization_id = null
where id = '99999999-0000-0000-0000-000000000001';

select 'Admin Sistema criado — login: admin.sistema@saas-sap.internal / troque a senha já' as resultado;
