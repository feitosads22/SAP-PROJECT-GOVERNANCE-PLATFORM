import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [senha,    setSenha]    = useState('')
  const [modo,     setModo]     = useState<'entrar' | 'cadastrar'>('entrar')
  const [erro,     setErro]     = useState<string | null>(null)
  const [aviso,    setAviso]    = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    setErro(null); setAviso(null); setEnviando(true)
    const resultado = modo === 'entrar'
      ? await supabase.auth.signInWithPassword({ email, password: senha })
      : await supabase.auth.signUp({ email, password: senha })
    setEnviando(false)
    if (resultado.error) { setErro(resultado.error.message); return }
    if (modo === 'cadastrar' && !resultado.data.session)
      setAviso('Cadastro criado. Confirme o e-mail para entrar.')
  }

  return (
    <div className="tela-centro">
      <div className="cartao">
        <div className="auth-logo">
          <span className="auth-logo__icon">⬡</span>
          <p className="auth-logo__title">SAP Governance</p>
          <p className="auth-logo__sub">Plataforma de gestão de projetos SAP</p>
        </div>

        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="email"
          value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />

        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password"
          autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
          value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" />

        {erro  && <p className="erro"  style={{ marginTop:'0.25rem' }}>{erro}</p>}
        {aviso && <p className="aviso" style={{ marginTop:'0.25rem' }}>{aviso}</p>}

        <button
          style={{ marginTop:'1rem' }}
          onClick={enviar} disabled={enviando || !email || !senha}>
          {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>

        <button className="btn-ghost" style={{ marginTop:'0.25rem' }}
          onClick={() => { setModo(m => m === 'entrar' ? 'cadastrar' : 'entrar'); setErro(null); setAviso(null) }}>
          {modo === 'entrar' ? 'Não tenho conta' : 'Já tenho conta'}
        </button>
      </div>
    </div>
  )
}
