import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Onboarding() {
  const { session } = useAuth()
  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading]  = useState(false)
  const [erro, setErro]        = useState<string | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim() || !fullName.trim()) return
    setErro(null); setLoading(true)
    try {
      const { data: org, error: orgErr } = await sb.from('organizations').insert({ name: orgName.trim() }).select().single()
      if (orgErr) throw orgErr
      const { error: profErr } = await sb.from('profiles').upsert({
        id: session!.user.id,
        email: session!.user.email,
        full_name: fullName.trim(),
        organization_id: org.id,
        role: 'admin',
      })
      if (profErr) throw profErr
      window.location.reload()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : String(err))
    }
    setLoading(false)
  }

  return (
    <div className="tela-centro">
      <div className="cartao">
        <div className="auth-logo">
          <div className="auth-logo__icon">⬡</div>
          <div className="auth-logo__title">Configuração inicial</div>
          <div className="auth-logo__sub">Crie sua organização para começar</div>
        </div>

        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Seu nome completo</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Ex: Bruna Lemos" required />
          </div>
          <div className="form-group">
            <label>Nome da organização</label>
            <input value={orgName} onChange={e => setOrgName(e.target.value)}
              placeholder="Ex: SPS Consulting" required />
          </div>

          {erro && (
            <div style={{ background:'var(--danger-bg)', color:'var(--danger)', border:'1px solid #fecaca', borderRadius:'var(--r)', padding:'.625rem .875rem', fontSize:'.875rem', marginBottom:'.875rem' }}>
              {erro}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width:'100%', marginTop:'.25rem' }}>
            {loading ? 'Criando…' : 'Criar organização'}
          </button>
        </form>
      </div>
    </div>
  )
}
