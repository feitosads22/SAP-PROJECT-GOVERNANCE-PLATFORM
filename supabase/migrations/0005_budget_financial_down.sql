-- =====================================================================
-- ROLLBACK de 0005_budget_financial.sql
-- =====================================================================
begin;
drop trigger if exists trg_project_costs_budget_alert     on public.project_costs;
drop trigger if exists trg_project_forecasts_budget_alert on public.project_forecasts;
drop trigger if exists trg_project_budgets_audit          on public.project_budgets;
drop trigger if exists trg_project_costs_reference_month  on public.project_costs;
drop trigger if exists trg_project_budgets_updated_at     on public.project_budgets;
drop trigger if exists trg_project_costs_updated_at       on public.project_costs;
drop trigger if exists trg_project_forecasts_updated_at   on public.project_forecasts;
drop trigger if exists trg_project_budgets_org_id         on public.project_budgets;
drop trigger if exists trg_project_costs_org_id           on public.project_costs;
drop trigger if exists trg_project_forecasts_org_id       on public.project_forecasts;
drop function if exists public.log_budget_approval();
drop function if exists public.notify_budget_alert();
drop function if exists public.set_cost_reference_month();
drop view  if exists public.project_financial_summary;
drop table if exists public.project_forecasts cascade;
drop table if exists public.project_costs     cascade;
drop table if exists public.project_budgets   cascade;
commit;
