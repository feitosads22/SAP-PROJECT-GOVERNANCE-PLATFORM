import { useEffect, useState } from 'react'
import {
  getTimesheets,
  createTimesheet,
  approveTimesheet,
  rejectTimesheet,
  getMyResource,
} from '../lib/resources'
import { getProjects } from '../lib/api'
import { getTasksByProject } from '../lib/api'
import type { Timesheet } from '../lib/resources'
import type { Project, Task } from '../types/app.types'


function extractError(err: unknown): string {
  if (!err) return 'Erro desconhecido.'
  if (typeof err === 'string') return err
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e['message'] === 'string') return e['message']
    if (typeof e['details'] === 'string') return e['details']
    if (typeof e['hint']    === 'string') return e['hint']
  }
  return 'Erro desconhecido.'
}

type Props = { userId: string; role: string }

export default function TimesheetPage({ userId, role }: Props) {
  const [timesheets,    setTimesheets]    = useState<Timesheet[]>([])
  const [projects,      setProjects]      = useState<Project[]>([])
  const [tasks,         setTasks]         = useState<Task[]>([])
  const [myResourceId,  setMyResourceId]  = useState<string | null>(null)
  const [carregando,    setCarregando]    = useState(true)
  const [loadingTasks,  setLoadingTasks]  = useState(false)
  const [erro,          setErro]          = useState<string | null>(null)
  const [saving,        setSaving]        = useState(false)
  const [rejMotivo,     setRejMotivo]     = useState<Record<string, string>>({})
  const [rejecting,     setRejecting]     = useState<string | null>(null)

  // form
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10))
  const [hours,       setHours]       = useState('')
  const [projectId,   setProjectId]   = useState('')
  const [taskId,      setTaskId]      = useState('')
  const [description, setDescription] = useState('')

  const canApprove = role === 'admin' || role === 'manager'
  const canLaunch  = role === 'admin' || role === 'manager' || role === 'consultant'

  async function load() {
    setCarregando(true)
    const [resTs, resPrj, resR] = await Promise.all([
      getTimesheets(canApprove ? {} : { resourceId: myResourceId ?? undefined }),
      getProjects(),
      getMyResource(userId),
    ])
    if (resTs.error) setErro(extractError(resTs.error))
    else setTimesheets((resTs.data ?? []) as Timesheet[])
    if (!resPrj.error) setProjects(resPrj.data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!resR.error && resR.data) setMyResourceId((resR.data as any).id)
    setCarregando(false)
  }

  useEffect(() => { void load() }, [userId])

  // Carregar tarefas quando o projeto muda
  async function handleProjectChange(pid: string) {
    setProjectId(pid)
    setTaskId('')
    setTasks([])
    if (!pid) return
    setLoadingTasks(true)
    const { data, error } = await getTasksByProject(pid)
    if (!error) setTasks((data ?? []) as unknown as Task[])
    setLoadingTasks(false)
  }

  async function handleCreate() {
    if (!myResourceId) {
      setErro('Seu perfil não tem um recurso cadastrado. Peça ao administrador.')
      return
    }
    if (!projectId || !hours || !date) { setErro('Preencha data, projeto e horas.'); return }
    const h = parseFloat(hours)
    if (isNaN(h) || h <= 0 || h > 24) { setErro('Horas deve ser entre 0.5 e 24.'); return }

    setSaving(true); setErro(null)
    const { error } = await createTimesheet({
      resource_id:  myResourceId,
      project_id:   projectId,
      task_id:      taskId || undefined,
      date,
      hours: h,
      description: description || undefined,
    })
    setSaving(false)
    if (error) { setErro(extractError(error)); return }
    setHours(''); setDescription(''); setTaskId('')
    void load()
  }

  async function handleApprove(ts: Timesheet) {
    const { error } = await approveTimesheet(ts.id, userId)
    if (error) setErro(extractError(error))
    else void load()
  }
  async function handleReject(ts: Timesheet) {
    const motivo = rejMotivo[ts.id]?.trim()
    if (!motivo) { setErro('Informe o motivo da reprovação.'); return }
    setRejecting(ts.id)
    const { error } = await rejectTimesheet(ts.id, userId, motivo)
    setRejecting(null)
    if (error) setErro(extractError(error))
    else { setRejMotivo(p => { const n = {...p}; delete n[ts.id]; return n }); void load() }
  }


  const totalHoras = timesheets.reduce((s, t) => s + Number(t.hours), 0)

  // Tarefas ativas (excluir concluídas/canceladas) para o combo
  const activeTasks = tasks.filter(
    t => t.status !== 'completed' && t.status !== 'cancelled'
  )

  return (
    <div className="page">
      <header className="topo">
        <div>
          <h1>Timesheet</h1>
          <p className="sutil">{timesheets.length} lançamentos · {totalHoras}h total</p>
        </div>
      </header>

      {canLaunch && (
        <div className="ts-form">
          <h2 className="section-title">Lançar horas</h2>
          <div className="ts-form__grid">

            <div>
              <label htmlFor="ts-date">Data</label>
              <input
                id="ts-date" type="date" value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="ts-project">Projeto</label>
              <select
                id="ts-project" value={projectId}
                onChange={e => handleProjectChange(e.target.value)}
              >
                <option value="">Selecione…</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ts-task">
                Tarefa {loadingTasks ? '(carregando…)' : '(opcional)'}
              </label>
              <select
                id="ts-task" value={taskId}
                disabled={!projectId || loadingTasks}
                onChange={e => setTaskId(e.target.value)}
              >
                <option value="">— Geral / sem tarefa —</option>
                {activeTasks.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ts-hours">Horas</label>
              <input
                id="ts-hours" type="number"
                min="0.5" max="24" step="0.5" value={hours}
                placeholder="Ex: 4"
                onChange={e => setHours(e.target.value)}
              />
            </div>

            <div className="ts-form__desc">
              <label htmlFor="ts-desc">Descrição</label>
              <input
                id="ts-desc" value={description}
                placeholder="O que foi feito?"
                onChange={e => setDescription(e.target.value)}
              />
            </div>

          </div>
          {erro && <p className="erro">{erro}</p>}
          <button onClick={handleCreate} disabled={saving || !projectId || !hours || !date}>
            {saving ? 'Salvando…' : 'Lançar horas'}
          </button>
        </div>
      )}

      {carregando && <p className="sutil">Carregando…</p>}
      {!carregando && timesheets.length === 0 && (
        <p className="sutil">Nenhum lançamento encontrado.</p>
      )}

      <table className="tabela">
        <thead>
          <tr>
            <th>Data</th>
            <th>Consultor</th>
            <th>Projeto</th>
            <th>Tarefa</th>
            <th>Horas</th>
            <th>Descrição</th>
            <th>Status</th>
            {canApprove && <th>Ação</th>}
          </tr>
        </thead>
        <tbody>
          {timesheets.map(ts => {
            const row      = ts as unknown as Record<string, unknown>
            const resource = row['resource'] as { profile: { full_name: string | null } } | null
            const project  = row['project']  as { code: string } | null
            const task     = row['task']     as { title: string } | null
            const aprovado = ts.approved_by !== null
            return (
              <tr key={ts.id}>
                <td>{new Date(ts.date).toLocaleDateString('pt-BR')}</td>
                <td>{resource?.profile?.full_name ?? '—'}</td>
                <td>{project?.code ?? '—'}</td>
                <td>{task?.title ?? <span className="sutil">—</span>}</td>
                <td><strong>{ts.hours}h</strong></td>
                <td>{ts.description ?? '—'}</td>
                <td>
                  {aprovado
                    ? <span className="badge badge--approved">Aprovado</span>
                    : <span className="badge badge--submitted">Pendente</span>}
                </td>
                {canApprove && (
                  <td>
                    {!aprovado && !Boolean((ts as unknown as Record<string,unknown>)['rejected_by']) && (
                      <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
                        <button className="btn-sm btn-sm--ok"
                          onClick={() => handleApprove(ts)}>
                          ✓ Aprovar
                        </button>
                        <div style={{ display:'flex', gap:'0.35rem' }}>
                          <input
                            placeholder="Motivo"
                            value={rejMotivo[ts.id] ?? ''}
                            onChange={e => setRejMotivo(p => ({ ...p, [ts.id]: e.target.value }))}
                            style={{ fontSize:'0.75rem', padding:'0.25rem 0.4rem' }}
                          />
                          <button
                            className="btn-sm btn-sm--danger"
                            disabled={rejecting === ts.id || !rejMotivo[ts.id]?.trim()}
                            onClick={() => handleReject(ts)}>
                            ✗
                          </button>
                        </div>
                      </div>
                    )}
                    {Boolean((ts as unknown as Record<string,unknown>)['rejected_by']) && (
                      <span className="badge badge--rejected">Reprovado</span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
