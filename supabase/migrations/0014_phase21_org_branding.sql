-- Fase 21 — White-label leve por organização (Dashboard e telas com a cara do cliente)

alter table public.organizations add column if not exists logo_url text;
alter table public.organizations add column if not exists primary_color text;

comment on column public.organizations.logo_url is 'Logo do cliente (data URI SVG ou URL) exibido na sidebar/topbar em vez da marca padrão.';
comment on column public.organizations.primary_color is 'Cor de marca do cliente (hex, ex: #1B4F72) — sobrepõe --brand na sidebar/topbar quando definida.';
