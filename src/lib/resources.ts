import { supabase } from './supabase'
import type { Database } from '../types/database.types'

export type Resource = Database['public']['Tables']['resources']['Row']
export type ResourceAllocation = Database['public']['Tables']['resource_allocations']['Row']
export type Timesheet = Database['public']['Tables']['timesheets']['Row']

export type CapacityRow = {
  resource_id: string
  organization_id: string
  full_name: string | null
  email: string | null
  seniority: string
  sap_modules: string[]
  weekly_capacity_hours: number
  hourly_rate: number | null
  is_active: boolean
  total_allocated_hours: number
  hours_this_week: number
  hours_this_month: number
  utilization_pct: number
  capacity_status: 'disponivel' | 'atencao' | 'overload' | 'indisponivel'
}

// ── Resources ─────────────────────────────────────────────────────────
export async function getResources() {
  return supabase
    .from('resources')
    .select(`
      *,
      profile:profiles(id, full_name, email, role)
    `)
    .eq('is_active', true)
    .order('created_at')
}

export async function createResource(data: Database['public']['Tables']['resources']['Insert']) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('resources').insert(data).select().single()
}

export async function updateResource(id: string, data: Database['public']['Tables']['resources']['Update']) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('resources').update(data).eq('id', id)
}

// ── Capacity view ─────────────────────────────────────────────────────
export async function getCapacity(): Promise<{ data: CapacityRow[] | null; error: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('resource_capacity')
    .select('*')
    .eq('is_active', true)
    .order('full_name')
}

// ── Allocations ───────────────────────────────────────────────────────
export async function getAllocationsByProject(projectId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('resource_allocations')
    .select(`
      *,
      resource:resources(id, seniority, sap_modules,
        profile:profiles(id, full_name, email))
    `)
    .eq('project_id', projectId)
}

// Alocações ativas de um recurso específico (para o dashboard do consultor)
export async function getAllocationsByResource(resourceId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('resource_allocations')
    .select(`*, project:projects(id, name, code)`)
    .eq('resource_id', resourceId)
}

// Todas as alocações da organização (para a tela de gestão de recursos)
export async function getAllocations() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('resource_allocations')
    .select(`
      *,
      resource:resources(id, profile:profiles(id, full_name, email)),
      project:projects(id, name, code)
    `)
    .order('start_date', { ascending: false })
}

type AllocationInsert = Omit<Database['public']['Tables']['resource_allocations']['Insert'], 'organization_id'> & {
  organization_id?: string
}
export async function createAllocation(data: AllocationInsert) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('resource_allocations').insert(data).select().single()
}

export async function deleteAllocation(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('resource_allocations').delete().eq('id', id)
}

// Perfis (não-cliente) que ainda não têm um recurso vinculado
export async function getAllocatableProfiles() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const [{ data: profiles, error: pErr }, { data: resources, error: rErr }] = await Promise.all([
    sb.from('profiles').select('id, full_name, email, role').neq('role', 'customer').order('full_name'),
    sb.from('resources').select('profile_id'),
  ])
  if (pErr) return { data: null, error: pErr }
  if (rErr) return { data: null, error: rErr }
  const linked = new Set((resources ?? []).map((r: { profile_id: string }) => r.profile_id))
  return { data: (profiles ?? []).filter((p: { id: string }) => !linked.has(p.id)), error: null }
}

// ── Timesheets ────────────────────────────────────────────────────────
export async function getTimesheets(filters: {
  resourceId?: string
  projectId?: string
  startDate?: string
  endDate?: string
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from('timesheets')
    .select(`
      *,
      resource:resources(id, profile:profiles(id, full_name)),
      project:projects(id, name, code),
      task:tasks(id, title)
    `)
    .order('date', { ascending: false })

  if (filters.resourceId) q = q.eq('resource_id', filters.resourceId)
  if (filters.projectId)  q = q.eq('project_id',  filters.projectId)
  if (filters.startDate)  q = q.gte('date', filters.startDate)
  if (filters.endDate)    q = q.lte('date', filters.endDate)

  return q
}

export async function createTimesheet(data: Database['public']['Tables']['timesheets']['Insert']) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('timesheets').insert(data).select().single()
}

export async function approveTimesheet(id: string, approverId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('timesheets')
    .update({ approved_by: approverId, approved_at: new Date().toISOString() })
    .eq('id', id)
}

// ── My resource (para o consultant saber seu resource_id) ─────────────
export async function getMyResource(profileId: string): Promise<{ data: Resource | null; error: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('resources')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()
}

export async function rejectTimesheet(id: string, rejectedBy: string, reason: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any)
    .from('timesheets')
    .update({
      rejected_by:      rejectedBy,
      rejected_at:      new Date().toISOString(),
      rejection_reason: reason,
      approved_by:      null,
      approved_at:      null,
    })
    .eq('id', id)
}
