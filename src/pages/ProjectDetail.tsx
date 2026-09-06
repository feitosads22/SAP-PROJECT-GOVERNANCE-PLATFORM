import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject } from '../lib/api'
import type { Project } from '../types/app.types'
import KanbanBoard from '../components/KanbanBoard'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho', active: 'Ativo', on_hold: 'Em espera',
  completed: 'Concluído', cancelled: 'Cancelado',
}

type Props = { role: string; userId: string }

export default function ProjectDetail({ role, userId }: Props) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

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
    ? Math.round(
        (new Date(project.end_date).getTime() - new Date(project.start_date).getTime())
        / 86400000
      ) + ' dias'
    : '—'

  return (
    <div className="pagina pagina--wide">
      <header className="topo">
        <div>
          <button className="link" onClick={() => navigate('/')}>← Projetos</button>
          <h1>{project.name}</h1>
          <p className="sutil">
            {project.code} · {STATUS_LABEL[project.status] ?? project.status} ·{' '}
            {project.sap_module ?? 'Sem módulo'} · {duration}
          </p>
        </div>
        <div className="project-progress">
          <span className="project-progress__label">{project.progress}%</span>
          <div className="project-progress__bar">
            <div
              className="project-progress__fill"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      </header>

      {project.description && (
        <p className="project-desc">{project.description}</p>
      )}

      <h2 className="section-title">Kanban de tarefas</h2>
      <KanbanBoard projectId={project.id} role={role} userId={userId} />
    </div>
  )
}
