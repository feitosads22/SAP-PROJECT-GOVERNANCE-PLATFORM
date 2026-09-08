import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro(error.message)
    setLoading(false)
  }

  return (
    <div className="tela-centro">
      <div className="cartao">
        <div className="auth-logo">
          <div className="auth-logo__icon">⬡</div>
          <div className="auth-logo__title">SAP Governance</div>
          <div className="auth-logo__sub">Gestão de Projetos SAP</div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {erro && (
            <div style={{
              background:'var(--danger-bg)', color:'var(--danger)',
              border:'1px solid #fecaca', borderRadius:'var(--r)',
              padding:'.625rem .875rem', fontSize:'.875rem',
              marginBottom:'.875rem'
            }}>
              {erro}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ width:'100%', marginTop:'.25rem' }}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p style={{ textAlign:'center', marginTop:'1.5rem', fontSize:'.75rem', color:'var(--subtle-2)' }}>
          SAP Governance Platform · SPS Consulting
        </p>
      </div>
    </div>
  )
}
