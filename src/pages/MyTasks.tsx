import { useEffect, useState } from 'react'
import { getMyTasks } from '../lib/api'
import { supabase } from '../lib/supabase'
import { getProjects } from '../lib/api'
import type { Task, Project } from '../types/app.types'
import { TASK_STATUS_LABEL, PRIORITY_LABEL, PRIORITY_COLOR } from '../types/app.types'
import EvidencePanel from '../components/EvidencePanel'
import CreateTaskModal from '../components/CreateTaskModal'

type Props = { userId: string; role: string }

export default function MyTasks({ userId, role }: Props) {
  const [tasks,      setTasks]      = useState<Task[]>([])
  const [projects,   setProjects]   = useState<Project[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro,       setErro]       = useState<string | null>(null)
  const [selected,   setSelected]   = useState<Task | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [orgId,      setOrgId]      = useState<string | null>(null)

  const canCreate = role === 'admin' || role === 'manager'

  async function load() {
    setCarregando(true)
    const [rProfile, rTasks, rProjects] = await Promise.all([
      supabase.from('profiles').select('organization_id').eq('id', userId).maybeSingle(),
      getMyTasks(userId),
      getProjects(),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((rProfile.data as any)?.organization_id) setOrgId((rProfile.data as any).organization_id)
    if (rTasks.error) setErro(rTasks.error.message)
    else setTasks((rTasks.data ?? []) as unknown as Task[])
    if (!rProjects.error) setProjects(rProjects.data ?? [])
    setCarregando(false)
  }

  useEffect(() => { void load() }, [userId])

  const overdue = tasks.filter(t => t.planned_end_date && new Date(t.planned_end_date) < new Date())

  return (
    <div className="pagina">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Minhas tarefas</h1>
          <p className="sutil">
            {tasks.length} ativa{tasks.length !== 1 ? 's' : ''}
            {overdue.length > 0 && (
              <span className="overdue-label" style={{ marginLeft:'0.5rem' }}>
                · {overdue.length} em atraso
              </span>
            )}
          </p>
        </div>
        <div className="page-header__actions">
          {canCreate && (
            <button onClick={() => setShowCreate(true)}>+ Nova tarefa</button>
          )}
        </div>
      </div>

      {erro      && <p className="erro">{erro}</p>}
      {carregando && <p className="sutil">Carregando…</p>}
      {!carregando && tasks.length === 0 && (
        <p className="sutil">Nenhuma tarefa ativa atribuída a você.</p>
      )}

      {tasks.length > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Prioridade</th>
              <th>Tarefa</th>
              <th>Projeto</th>
              <th>Fase SAP</th>
              <th>Status</th>
              <th>Prazo</th>
              <th>Evidência</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => {
              const row     = t as unknown as Record<string, unknown>
              const projeto  = row['project'] as { name: string; code: string } | null
              const sapPhase = row['sap_activate_phase'] as string | undefined
              const atrasada = t.planned_end_date && new Date(t.planned_end_date) < new Date()
              const prio = t.priority as keyof typeof PRIORITY_COLOR
              return (
                <tr key={t.id} className={atrasada ? 'row--overdue' : ''}
                  style={{ cursor:'pointer' }} onClick={() => setSelected(t)}>
                  <td>
                    <span className="badge" style={{
                      background: PRIORITY_COLOR[prio] + '22',
                      color: PRIORITY_COLOR[prio],
                      borderColor: PRIORITY_COLOR[prio] + '44',
                    }}>
                      {PRIORITY_LABEL[prio]}
                    </span>
                  </td>
                  <td><strong>{t.title}</strong></td>
                  <td>{projeto?.code ?? '—'}</td>
                  <td>{sapPhase ? <span className="badge badge--ev">{sapPhase}</span> : '—'}</td>
                  <td>{TASK_STATUS_LABEL[t.status as keyof typeof TASK_STATUS_LABEL]}</td>
                  <td className={atrasada ? 'overdue-label' : ''}>
                    {t.planned_end_date
                      ? new Date(t.planned_end_date).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td>{t.requires_evidence ? <span className="badge badge--ev">Obrig.</span> : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {selected && (
        <EvidencePanel task={selected} role={role} userId={userId}
          onClose={() => { setSelected(null); void load() }} />
      )}

      {showCreate && orgId && (
        <CreateTaskModal
          projectId={projects[0]?.id ?? ''}
          organizationId={orgId}
          projects={projects}
          onCreated={() => { setShowCreate(false); void load() }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
