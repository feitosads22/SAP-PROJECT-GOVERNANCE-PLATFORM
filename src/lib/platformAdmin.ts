import { supabase } from './supabase'

export type OrganizationRow = {
  id: string
  name: string
  slug: string
  sap_client_number: string | null
  created_at: string
}

export async function getOrganizations() {
  return supabase.from('organizations').select('*').order('created_at', { ascending: false })
}

export async function getAllProjectsOrgIds() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('projects').select('organization_id')
}

export async function getAllProfilesOrgIds() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('profiles').select('organization_id, role')
}

export async function createOrganization(data: { name: string; slug: string; sap_client_number?: string | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('organizations').insert(data).select().single()
}
