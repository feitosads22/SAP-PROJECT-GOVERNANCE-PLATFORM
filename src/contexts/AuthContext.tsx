import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/supabase'

export type OrgBranding = {
  id: string
  name: string
  logo_url: string | null
  primary_color: string | null
}

type AuthState = {
  session: Session | null
  profile: Profile | null
  organization: OrgBranding | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<OrgBranding | null>(null)

  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    // RLS já restringe: o usuário só enxerga o próprio profile e o da sua org.
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Falha ao carregar profile:', error.message)
      setProfile(null)
      setOrganization(null)
      return
    }
    const p = data as Profile | null
    setProfile(p)

    if (p?.organization_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: org } = await (supabase as any)
        .from('organizations')
        .select('id, name, logo_url, primary_color')
        .eq('id', p.organization_id)
        .maybeSingle()
      setOrganization(org ?? null)
    } else {
      setOrganization(null)
    }
  }

  useEffect(() => {
    let ativo = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evento, novaSessao) => {
      setSession(novaSessao)
      if (novaSessao) {
        await loadProfile(novaSessao.user.id)
      } else {
        setProfile(null)
        setOrganization(null)
      }
      setLoading(false)
    })

    return () => {
      ativo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value: AuthState = {
    session,
    profile,
    organization,
    loading,
    refreshProfile: async () => {
      if (session) await loadProfile(session.user.id)
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
