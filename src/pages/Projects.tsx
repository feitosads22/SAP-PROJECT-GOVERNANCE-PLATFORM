import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Project, Organization } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const STATUS: Record<string, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  on_hold: 'Em espera',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const PRIORIDADE: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
}

export default function Projects() {
  const { profile, signOut } = useAuth()
  const [projetos, setProjetos] = useState<Project[]>([])
  const [org, setOrg] = useState<Organization | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Nenhum filtro por organization_id no cliente: quem filtra é a RLS.
  // Se a policy falhar, o vazamento aparece aqui — é intencional.
  useEffect(() => {
    let ativo = true

    async function carregar() {
      const [resProjetos, resOrg] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('organizations').select('*').maybeSingle(),
      ])

      if (!ativo) return

      if (resProjetos.error) setErro(resProjetos.error.message)
      else setProjetos(resProjetos.data)

      if (!resOrg.error) setOrg(resOrg.data)
      setCarregando(false)
    }

    void carregar()
    return () => {
      ativo = false
    }
  }, [])

  const podeCriar = profile?.role === 'admin' || profile?.role === 'manager'

  return (
    <div className="pagina">
      <header className="topo">
        <div>
          <h1>Projetos</h1>
          <p className="sutil">
            {org?.name ?? 'Organização'} · {profile?.full_name ?? profile?.email} ·{' '}
            <strong>{profile?.role}</strong>
          </p>
        </div>
        <button className="link" onClick={signOut}>
          Sair
        </button>
      </header>

      {erro && <p className="erro">{erro}</p>}
      {carregando && <p className="sutil">Carregando…</p>}

      {!carregando && projetos.length === 0 && (
        <p className="sutil">Nenhum projeto nesta organização.</p>
      )}

      <table className="tabela">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nome</th>
            <th>Módulo SAP</th>
            <th>Status</th>
            <th>Prioridade</th>
            <th>Progresso</th>
          </tr>
        </thead>
        <tbody>
          {projetos.map((p) => (
            <tr key={p.id}>
              <td>{p.code}</td>
              <td>{p.name}</td>
              <td>{p.sap_module ?? '—'}</td>
              <td>{STATUS[p.status] ?? p.status}</td>
              <td>{PRIORIDADE[p.priority] ?? p.priority}</td>
              <td>{p.progress}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!podeCriar && !carregando && (
        <p className="sutil">
          Seu perfil não cria projetos. A restrição está na policy do banco, não nesta
          tela — esconder o botão é conveniência, não segurança.
        </p>
      )}
    </div>
  )
}
