-- =====================================================================
-- Fase 22 (fix): views de relatório vazavam dados entre organizações.
--
-- Todas as views abaixo pertencem ao owner "postgres", que tem
-- BYPASSRLS. Por padrão, uma view herda o comportamento de RLS do seu
-- DONO na hora de checar permissão nas tabelas de baixo — e como o dono
-- ignora RLS, a view IGNORAVA todas as políticas de isolamento por
-- organization_id, retornando linhas de TODOS os tenants pra qualquer
-- usuário autenticado (ex.: Portfólio mostrando projetos de outros
-- clientes da plataforma).
--
-- security_invoker = true (Postgres 15+) faz a view rodar com as
-- permissões e RLS de quem está consultando, não do dono — resolve o
-- vazamento sem precisar reescrever nenhuma query.
-- =====================================================================

alter view public.portfolio_summary     set (security_invoker = true);
alter view public.project_financial     set (security_invoker = true);
alter view public.project_monthly_costs set (security_invoker = true);
alter view public.resource_capacity     set (security_invoker = true);
alter view public.resources_public      set (security_invoker = true);
alter view public.customer_portal       set (security_invoker = true);
