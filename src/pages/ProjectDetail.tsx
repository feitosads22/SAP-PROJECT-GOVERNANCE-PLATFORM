import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject } from '../lib/api'
import type { Project } from '../types/app.types'
import KanbanBoard from '../components/KanbanBoard'

const STATUS_LABEL: Record<string,string> = {
  draft:'Rascunho', active:'Ativo', on_hold:'Em espera',
  completed:'Concluído', cancelled:'Cancelado',
}
const STATUS_COLOR: Record<string,string> = {
  draft:'#94a3b8', active:'#16a34a', on_hold:'#d97706',
  completed:'#1d4ed8', cancelled:'#dc2626',
}

type Props = { role: string; userId: string }

export default function ProjectDetail({ role, userId }: Props) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project,    setProject]    = useState<Project | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro,       setErro]       = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setCarregando(true)
    getProject(id).then(({ data, error }) => {
      if (error) setErro(error.message)
      else setProject(data)
      setCarregando(false)
    })
  }, [id])

  if (carregando) return <div className="pagina"><p className="sutil">Carregando…</p></div>
  if (erro || !project) return (
    <div className="pagina">
      <p className="erro">{erro ?? 'Projeto não encontrado.'}</p>
      <button className="link" onClick={() => navigate('/')}>← Voltar</button>
    </div>
  )

  const duration = project.start_date && project.end_date
    ? Math.round((new Date(project.end_date).getTime() - new Date(project.start_date).getTime()) / 86400000) + ' dias'
    : null

  return (
    <div className="pagina pagina--wide">
      {/* Header */}
      <div className="page-header">
        <div className="page-header__left">
          <button className="btn-ghost" style={{ fontSize:'0.8125rem', padding:'0.25rem 0' }}
            onClick={() => navigate('/')}>
            ← Projetos
          </button>
          <h1>{project.name}</h1>
          <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap' }}>
            <span className="badge" style={{ background: STATUS_COLOR[project.status], color:'#fff', borderColor:'transparent' }}>
              {STATUS_LABEL[project.status] ?? project.status}
            </span>
            {project.sap_module && <span className="badge">{project.sap_module}</span>}
            {project.code       && <span className="badge">{project.code}</span>}
            {duration           && <span className="sutil">{duration}</span>}
          </div>
        </div>

        <div className="page-header__actions">
          <button className="btn-outline" onClick={() => navigate(`/projeto/${project.id}/financeiro`)}>
            💰 Financeiro
          </button>
          <button className="btn-outline" onClick={() => navigate(`/projeto/${project.id}/governanca`)}>
            🛡️ Governança
          </button>
          <div className="project-progress">
            <span className="project-progress__label">{project.progress}%</span>
            <div className="project-progress__bar">
              <div className="project-progress__fill" style={{ width:`${project.progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {project.description && <p className="project-desc">{project.description}</p>}

      <KanbanBoard
        projectId={project.id}
        organizationId={project.organization_id}
        role={role}
        userId={userId}
      />
    </div>
  )
}
