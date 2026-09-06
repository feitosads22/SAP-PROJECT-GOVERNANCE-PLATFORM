-- Ambiente mínimo equivalente ao Supabase, para executar a migration de verdade.
create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  instance_id        uuid,
  id                 uuid primary key,
  aud                text,
  role               text,
  email              text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data  jsonb,
  raw_user_meta_data jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', current_setting('role', true));
$$;

-- Supabase concede privilégios por default privileges; a migration não faz isso.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

-- Colunas de token que o GoTrue real exige (para testar o seed adaptado)
alter table auth.users add column if not exists confirmation_token text default '';
alter table auth.users add column if not exists email_change text default '';
alter table auth.users add column if not exists email_change_token_new text default '';
alter table auth.users add column if not exists recovery_token text default '';

create table if not exists auth.identities (
  id             uuid default gen_random_uuid(),
  provider_id    text not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  identity_data  jsonb not null,
  provider       text not null,
  last_sign_in_at timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  primary key (provider, provider_id)
);
