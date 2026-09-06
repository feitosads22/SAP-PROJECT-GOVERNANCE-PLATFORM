import { useEffect, useState } from 'react'
import { getMyTasks } from '../lib/api'
import type { Task } from '../types/app.types'
import { TASK_STATUS_LABEL, PRIORITY_LABEL } from '../types/app.types'
import EvidencePanel from '../components/EvidencePanel'

type Props = { userId: string; role: string }

export default function MyTasks({ userId, role }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [selected, setSelected] = useState<Task | null>(null)

  async function load() {
    setCarregando(true)
    const { data, error } = await getMyTasks(userId)
    if (error) setErro(error.message)
    else setTasks((data ?? []) as unknown as Task[])
    setCarregando(false)
  }

  useEffect(() => { void load() }, [userId])

  const overdue = tasks.filter(
    t => t.planned_end_date && new Date(t.planned_end_date) < new Date(),
  )

  return (
    <div className="pagina">
      <header className="topo">
        <div>
          <h1>Minhas tarefas</h1>
          {overdue.length > 0 && (
            <p className="overdue-label">
              {overdue.length} tarefa{overdue.length > 1 ? 's' : ''} em atraso
            </p>
          )}
        </div>
      </header>

      {erro && <p className="erro">{erro}</p>}
      {carregando && <p className="sutil">Carregando…</p>}

      {!carregando && tasks.length === 0 && (
        <p className="sutil">Nenhuma tarefa ativa atribuída a você.</p>
      )}

      <table className="tabela">
        <thead>
          <tr>
            <th>Projeto</th>
            <th>Módulo</th>
            <th>Tarefa</th>
            <th>Prioridade</th>
            <th>Status</th>
            <th>Prazo</th>
            <th>Progresso</th>
            <th>Evidência</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(t => {
            const atrasada = t.planned_end_date && new Date(t.planned_end_date) < new Date()
            const row = t as unknown as Record<string, unknown>
            const projeto = row['project'] as { name: string; code: string } | null
            const modulo  = row['module']  as { name: string; code: string } | null
            return (
              <tr
                key={t.id}
                className={atrasada ? 'row--overdue' : ''}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelected(t)}
              >
                <td>{projeto?.code ?? '—'}</td>
                <td>{modulo?.code ?? '—'}</td>
                <td>{t.title}</td>
                <td>{PRIORITY_LABEL[t.priority as keyof typeof PRIORITY_LABEL]}</td>
                <td>{TASK_STATUS_LABEL[t.status as keyof typeof TASK_STATUS_LABEL]}</td>
                <td className={atrasada ? 'overdue-label' : ''}>
                  {t.planned_end_date
                    ? new Date(t.planned_end_date).toLocaleDateString('pt-BR')
                    : '—'}
                </td>
                <td>{t.progress}%</td>
                <td>{t.requires_evidence ? '✓' : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {selected && (
        <EvidencePanel
          task={selected}
          role={role}
          userId={userId}
          onClose={() => { setSelected(null); void load() }}
        />
      )}
    </div>
  )
}
