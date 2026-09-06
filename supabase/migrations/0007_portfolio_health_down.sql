begin;
drop view if exists public.portfolio_summary;
drop function if exists public.calculate_health_score(uuid);
drop table if exists public.project_health_scores cascade;
commit;
