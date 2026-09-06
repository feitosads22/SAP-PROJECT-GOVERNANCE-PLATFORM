import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    setErro(null)
    setAviso(null)
    setEnviando(true)

    const resultado =
      modo === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password: senha })
        : await supabase.auth.signUp({ email, password: senha })

    setEnviando(false)

    if (resultado.error) {
      setErro(resultado.error.message)
      return
    }
    if (modo === 'cadastrar' && !resultado.data.session) {
      setAviso('Cadastro criado. Confirme o e-mail para entrar.')
    }
    // Sessão criada: o onAuthStateChange do AuthProvider assume daqui.
  }

  return (
    <div className="tela-centro">
      <div className="cartao">
        <h1>SAP Project Governance</h1>
        <p className="sutil">
          {modo === 'entrar' ? 'Acesse sua conta' : 'Crie sua conta'}
        </p>

        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="senha">Senha</label>
        <input
          id="senha"
          type="password"
          autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        {erro && <p className="erro">{erro}</p>}
        {aviso && <p className="aviso">{aviso}</p>}

        <button onClick={enviar} disabled={enviando || !email || !senha}>
          {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Cadastrar'}
        </button>

        <button
          className="link"
          onClick={() => {
            setModo(modo === 'entrar' ? 'cadastrar' : 'entrar')
            setErro(null)
            setAviso(null)
          }}
        >
          {modo === 'entrar' ? 'Não tenho conta' : 'Já tenho conta'}
        </button>
      </div>
    </div>
  )
}
