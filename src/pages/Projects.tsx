import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProjects } from '../lib/api'
import type { Project } from '../types/app.types'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho', active: 'Ativo', on_hold: 'Em espera',
  completed: 'Concluído', cancelled: 'Cancelado',
}
const STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8', active: '#22c55e', on_hold: '#f59e0b',
  completed: '#3b82f6', cancelled: '#ef4444',
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    getProjects().then(({ data, error }) => {
      if (error) setErro(error.message)
      else setProjects(data ?? [])
      setCarregando(false)
    })
  }, [])

  return (
    <div className="pagina">
      <header className="topo">
        <h1>Projetos</h1>
      </header>
      {erro && <p className="erro">{erro}</p>}
      {carregando && <p className="sutil">Carregando…</p>}
      {!carregando && projects.length === 0 && (
        <p className="sutil">Nenhum projeto nesta organização.</p>
      )}
      <div className="project-grid">
        {projects.map(p => (
          <Link key={p.id} to={`/projeto/${p.id}`} className="pcard">
            <div className="pcard__top">
              <span className="pcard__code">{p.code}</span>
              <span
                className="pcard__status"
                style={{ background: STATUS_COLOR[p.status] ?? '#94a3b8' }}
              >
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </div>
            <h2 className="pcard__name">{p.name}</h2>
            {p.description && <p className="pcard__desc">{p.description}</p>}
            <div className="pcard__bar-wrap">
              <div className="pcard__bar">
                <div className="pcard__bar-fill" style={{ width: `${p.progress}%` }} />
              </div>
              <span className="pcard__pct">{p.progress}%</span>
            </div>
            {p.sap_module && <p className="sutil pcard__module">{p.sap_module}</p>}
          </Link>
        ))}
      </div>
    </div>
  )
}
