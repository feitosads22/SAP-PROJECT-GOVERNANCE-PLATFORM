import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Falha de configuração não pode virar página branca: o build passa mesmo sem
 * as variáveis (o bundler descarta o código morto depois de um throw no topo),
 * e o erro só apareceria no console. Sinalizamos e a App mostra a instrução.
 */
export const configuracaoOk = Boolean(url && anonKey)

// Apenas a anon key. A service_role nunca entra no frontend.
export const supabase = createClient<Database>(
  url || 'https://configuracao-ausente.invalid',
  anonKey || 'configuracao-ausente',
  { auth: { persistSession: true, autoRefreshToken: true } },
)

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type Organization = Database['public']['Tables']['organizations']['Row']

export type AppRole = 'pending' | 'admin' | 'manager' | 'consultant' | 'customer'

export function isRole(value: string): value is AppRole {
  return ['pending', 'admin', 'manager', 'consultant', 'customer'].includes(value)
}
