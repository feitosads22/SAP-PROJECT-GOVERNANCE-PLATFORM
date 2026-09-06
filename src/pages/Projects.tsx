import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProjects } from '../lib/api'
import type { Project } from '../types/app.types'

const STATUS_LABEL: Record<string, string> = {
  draft:'Rascunho', active:'Ativo', on_hold:'Em espera',
  completed:'Concluído', cancelled:'Cancelado',
}
const STATUS_COLOR: Record<string, string> = {
  draft:'#94a3b8', active:'#16a34a', on_hold:'#d97706',
  completed:'#1d4ed8', cancelled:'#dc2626',
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState<string | null>(null)

  useEffect(() => {
    getProjects().then(({ data, error }) => {
      if (error) setErro(error.message)
      else setProjects(data ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <div className="pagina">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Projetos</h1>
          <p className="sutil">{projects.length} projeto{projects.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {erro    && <p className="erro">{erro}</p>}
      {loading && <p className="sutil">Carregando…</p>}
      {!loading && projects.length === 0 && (
        <p className="sutil">Nenhum projeto nesta organização.</p>
      )}

      <div className="project-grid">
        {projects.map(p => (
          <Link key={p.id} to={`/projeto/${p.id}`} className="pcard">
            <div className="pcard__top">
              <span className="pcard__code">{p.code}</span>
              <span className="pcard__status"
                style={{ background: STATUS_COLOR[p.status] ?? '#94a3b8' }}>
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </div>
            <h2 className="pcard__name">{p.name}</h2>
            {p.description && <p className="pcard__desc">{p.description}</p>}
            <div className="pcard__bar-wrap">
              <div className="pcard__bar">
                <div className="pcard__bar-fill" style={{ width:`${p.progress}%` }} />
              </div>
              <span className="pcard__pct">{p.progress}%</span>
            </div>
            <div className="pcard__footer">
              {p.sap_module && <span className="badge">{p.sap_module}</span>}
              <span className="badge">
                {p.start_date ? new Date(p.start_date).toLocaleDateString('pt-BR',{month:'short',year:'numeric'}) : '—'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
