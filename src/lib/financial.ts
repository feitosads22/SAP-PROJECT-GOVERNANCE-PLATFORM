import { supabase } from './supabase'
import type { Database } from '../types/database.types'

export type ProjectBudget   = Database['public']['Tables']['project_budgets']['Row']
export type ProjectCost     = Database['public']['Tables']['project_costs']['Row']
export type ProjectForecast = Database['public']['Tables']['project_forecasts']['Row']

export type FinancialRow = {
  project_id: string
  organization_id: string
  project_name: string
  project_code: string
  project_status: string
  progress: number
  budget_total: number
  revenue_planned: number
  cost_planned: number
  contingency_pct: number
  currency: string | null
  budget_approved_at: string | null
  cost_actual_manual: number
  cost_actual_labor: number
  cost_actual_total: number
  cost_forecast: number
  revenue_forecast: number
  variance: number
  variance_pct: number | null
  margin: number
  margin_pct: number | null
  financial_status: 'ok' | 'atencao' | 'estourado' | 'sem_orcamento'
}

// ── Budget ─────────────────────────────────────────────────────────────
export async function getBudget(projectId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('project_budgets').select('*')
    .eq('project_id', projectId).maybeSingle()
}

export async function upsertBudget(data: Database['public']['Tables']['project_budgets']['Insert']) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('project_budgets')
    .upsert(data, { onConflict: 'project_id' })
    .select().single()
}

export async function approveBudget(budgetId: string, approverId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('project_budgets')
    .update({ approved_by: approverId, approved_at: new Date().toISOString() })
    .eq('id', budgetId)
}

// ── Costs ──────────────────────────────────────────────────────────────
export async function getCosts(projectId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('project_costs').select('*')
    .eq('project_id', projectId)
    .order('cost_date', { ascending: false })
}

export async function createCost(data: Database['public']['Tables']['project_costs']['Insert']) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('project_costs').insert(data).select().single()
}

export async function deleteCost(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('project_costs').delete().eq('id', id)
}

// ── Forecasts ──────────────────────────────────────────────────────────
export async function getForecasts(projectId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('project_forecasts').select('*')
    .eq('project_id', projectId)
    .order('forecast_date', { ascending: false })
    .limit(12)
}

export async function createForecast(data: Database['public']['Tables']['project_forecasts']['Insert']) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('project_forecasts').insert(data).select().single()
}

// ── Financial view ─────────────────────────────────────────────────────
export async function getProjectFinancial(projectId: string): Promise<{ data: FinancialRow | null; error: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('project_financial').select('*')
    .eq('project_id', projectId).maybeSingle()
}

export async function getAllProjectsFinancial(): Promise<{ data: FinancialRow[] | null; error: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('project_financial').select('*').order('project_code')
}
