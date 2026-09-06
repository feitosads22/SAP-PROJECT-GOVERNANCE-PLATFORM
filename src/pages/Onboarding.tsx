import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Usuário autenticado sem organização (role 'pending').
 * A criação da organização passa obrigatoriamente pela RPC
 * create_organization(): é ela que cria a org e promove o criador a admin,
 * dentro de uma transação. O frontend não escreve role nem organization_id
 * em profiles — o trigger enforce_profile_privileges bloqueia isso.
 */
export default function Onboarding() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [clienteSap, setClienteSap] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function sugerirSlug(valor: string) {
    setNome(valor)
    setSlug(
      valor
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    )
  }

  async function criar() {
    setErro(null)
    setEnviando(true)
  const { error } = await (supabase as any).rpc('create_organization', {
      p_name: nome,
      p_slug: slug,
      p_sap_client_number: clienteSap || null,
    })

    setEnviando(false)

    if (error) {
      setErro(
        error.message.includes('ALREADY_IN_ORG')
          ? 'Você já pertence a uma organização.'
          : error.message,
      )
      return
    }
    await refreshProfile()
  }

  return (
    <div className="tela-centro">
      <div className="cartao">
        <h1>Criar organização</h1>
        <p className="sutil">
          {profile?.email} ainda não pertence a nenhuma organização. Crie a sua para
          começar — você será o administrador dela.
        </p>

        <label htmlFor="nome">Nome da organização</label>
        <input id="nome" value={nome} onChange={(e) => sugerirSlug(e.target.value)} />

        <label htmlFor="slug">Identificador</label>
        <input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />

        <label htmlFor="sap">Número do cliente SAP (opcional)</label>
        <input id="sap" value={clienteSap} onChange={(e) => setClienteSap(e.target.value)} />

        {erro && <p className="erro">{erro}</p>}

        <button onClick={criar} disabled={enviando || !nome || !slug}>
          {enviando ? 'Criando…' : 'Criar organização'}
        </button>
        <button className="link" onClick={signOut}>
          Sair
        </button>
      </div>
    </div>
  )
}
