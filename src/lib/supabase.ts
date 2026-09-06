import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias. Ver .env.example.',
  )
}

// Apenas a anon key. A service_role nunca entra no frontend.
export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
})

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type Organization = Database['public']['Tables']['organizations']['Row']

export type AppRole = 'pending' | 'admin' | 'manager' | 'consultant' | 'customer'

export function isRole(value: string): value is AppRole {
  return ['pending', 'admin', 'manager', 'consultant', 'customer'].includes(value)
}
