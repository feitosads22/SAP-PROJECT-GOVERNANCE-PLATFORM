import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Milestone = {
  id: string; name: string; description: string | null
  due_date: string; status: string; phase_id: string | null
}
type Task = {
  id: string; title: string; status: string; priority: string
  start_date: string | null; due_date: string | null
  sap_activate_phase: string | null; estimated_hours: number | null
  actual_hours: number | null; assignee_id: string | null
  progress: number
}

const STATUS_COLOR: Record<string, string> = {
  not_started: '#94A3B8', in_progress: '#0A6ED1',
  completed: '#16A34A', cancelled: '#DC2626',
}
const SAP_PHASE_COLOR: Record<string, string> = {
  Descobrir: '#8B5CF6', Preparar: '#3B82F6', Explorar: '#06B6D4',
  Realizar: '#10B981', Implementar: '#F59E0B', Executar: '#EF4444',
}
const TASK_STATUS_COLOR: Record<string, string> = {
  todo: '#94A3B8', in_progress: '#0A6ED1', blocked: '#DC2626',
  validation: '#F59E0B', adjustment_required: '#F97316',
  completed: '#16A34A', cancelled: '#6B7280',
}

type Props = { projectId?: string; role: string }

export default function SchedulePage({ projectId: propId, role }: Props) {
  const params = useParams<{ id: string }>()
  const projectId = propId ?? params.id
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [tasks,      setTasks]      = useState<Task[]>([])
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState<'gantt' | 'list'>('gantt')
  const [filterPhase,setFilterPhase]= useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const canEdit = ['admin', 'manager'].includes(role)

  async function load() {
    if (!projectId) return
    setLoading(true)
    const [rM, rT] = await Promise.all([
      sb.from('milestones').select('*').eq('project_id', projectId).order('due_date'),
      sb.from('tasks').select('id,title,status,priority,start_date,due_date,sap_activate_phase,estimated_hours,actual_hours,assignee_id,progress')
        .eq('project_id', projectId).order('due_date', { ascending: true }),
    ])
    if (!rM.error) setMilestones(rM.data ?? [])
    if (!rT.error) setTasks(rT.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [projectId])

  const phases = [...new Set(tasks.map(t => t.sap_activate_phase).filter(Boolean))] as string[]
  const filtered = tasks.filter(t => !filterPhase || t.sap_activate_phase === filterPhase)

  // Calcular range de datas para o gantt
  const allDates = [
    ...filtered.filter(t => t.start_date).map(t => new Date(t.start_date!)),
    ...filtered.filter(t => t.due_date).map(t => new Date(t.due_date!)),
    ...milestones.map(m => new Date(m.due_date)),
  ]
  const minDate = allDates.length > 0
    ? new Date(Math.min(...allDates.map(d => d.getTime())))
    : new Date()
  const maxDate = allDates.length > 0
    ? new Date(Math.max(...allDates.map(d => d.getTime())))
    : new Date(Date.now() + 30 * 86400000)
  const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000)) + 14

  function dayOffset(date: Date) {
    return Math.floor((date.getTime() - minDate.getTime()) / 86400000)
  }

  // Generate month labels
  const months: { label: string; left: number; width: number }[] = []
  let cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
  while (cur <= maxDate) {
    const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    const startDay = Math.max(0, dayOffset(cur))
    const endDay   = Math.min(totalDays, dayOffset(nextMonth))
    months.push({
      label: cur.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      left:  (startDay / totalDays) * 100,
      width: ((endDay - startDay) / totalDays) * 100,
    })
    cur = nextMonth
  }

  const today = new Date()
  const todayPct = Math.min(100, Math.max(0, (dayOffset(today) / totalDays) * 100))

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '.25rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '.2rem' }}>
          {(['gantt', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? 'var(--surface)' : 'none', border: 'none',
              borderRadius: 'var(--r-sm)', padding: '.3rem .75rem',
              fontSize: '.8125rem', fontWeight: view === v ? 600 : 400,
              color: view === v ? 'var(--text)' : 'var(--subtle)',
              boxShadow: view === v ? 'var(--shadow-xs)' : 'none',
            }}>
              {v === 'gantt' ? '📊 Gantt' : '☰ Lista'}
            </button>
          ))}
        </div>
        <select value={filterPhase} onChange={e => setFilterPhase(e.target.value)}
          style={{ width: 'auto', fontSize: '.8125rem' }}>
          <option value="">Todas as fases SAP</option>
          {phases.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {filterPhase && (
          <button className="btn-ghost btn-sm" onClick={() => setFilterPhase('')}>Limpar</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: 'var(--subtle)' }}>
          {filtered.length} tarefa{filtered.length !== 1 ? 's' : ''} · {milestones.length} marco{milestones.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {[1,2,3,4,5].map(i => <div key={i} style={{ height: 44, borderRadius: 'var(--r)' }} className="skeleton" />)}
        </div>
      ) : filtered.length === 0 && milestones.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📅</div>
          <div className="empty-state__title">Sem dados de cronograma</div>
          <p className="empty-state__desc">Adicione tarefas com datas de início e fim para visualizar o Gantt.</p>
        </div>
      ) : view === 'gantt' ? (
        /* ── GANTT VIEW ─────────────────────────────────── */
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 900 }}>
              {/* Month headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', borderBottom: '1px solid var(--border)' }}>
                <div style={{ padding: '.5rem 1rem', fontSize: '.6875rem', fontWeight: 700, color: 'var(--subtle)', background: 'var(--surface-2)' }}>TAREFA</div>
                <div style={{ position: 'relative', height: 32, background: 'var(--surface-2)' }}>
                  {months.map((m, i) => (
                    <div key={i} style={{ position: 'absolute', left: `${m.left}%`, width: `${m.width}%`, top: 0, bottom: 0, borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center', paddingLeft: '.375rem', fontSize: '.625rem', fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {m.label}
                    </div>
                  ))}
                  {/* Today line */}
                  <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 2, background: 'var(--danger)', opacity: .7 }} />
                </div>
              </div>

              {/* Milestones */}
              {milestones.map(m => {
                const d = new Date(m.due_date)
                const pct = Math.min(99, Math.max(0, (dayOffset(d) / totalDays) * 100))
                return (
                  <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '240px 1fr', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div style={{ padding: '.5rem 1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                      <span style={{ fontSize: '.875rem' }}>🔷</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                        <div style={{ fontSize: '.625rem', color: 'var(--subtle)' }}>{d.toLocaleDateString('pt-BR')}</div>
                      </div>
                    </div>
                    <div style={{ position: 'relative', height: 40 }}>
                      <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 12, height: 12, background: STATUS_COLOR[m.status] ?? '#94A3B8', borderRadius: 2, rotate: '45deg', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} title={m.name} />
                      <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 1, background: 'var(--danger)', opacity: .3 }} />
                    </div>
                  </div>
                )
              })}

              {/* Tasks grouped by SAP phase */}
              {(['Descobrir','Preparar','Explorar','Realizar','Implementar','Executar'] as const).map(ph => {
                const group = filtered.filter(t => t.sap_activate_phase === ph)
                if (!group.length) return null
                return (
                  <div key={ph}>
                    {/* Phase header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', background: SAP_PHASE_COLOR[ph] + '15', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ padding: '.375rem 1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: SAP_PHASE_COLOR[ph], flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: '.75rem', color: SAP_PHASE_COLOR[ph] }}>{ph}</span>
                        <span style={{ fontSize: '.6875rem', color: 'var(--subtle)' }}>({group.length})</span>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 1, background: 'var(--danger)', opacity: .3 }} />
                      </div>
                    </div>
                    {/* Tasks */}
                    {group.map(task => {
                      const start = task.start_date ? new Date(task.start_date) : null
                      const end   = task.due_date   ? new Date(task.due_date)   : null
                      const startPct = start ? Math.min(99, Math.max(0, (dayOffset(start) / totalDays) * 100)) : null
                      const endPct   = end   ? Math.min(100, Math.max(0, (dayOffset(end)   / totalDays) * 100)) : null
                      const width    = startPct !== null && endPct !== null ? Math.max(0.5, endPct - startPct) : null
                      const isOverdue = end && end < today && task.status !== 'completed'
                      return (
                        <div key={task.id} style={{ display: 'grid', gridTemplateColumns: '240px 1fr', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                          <div style={{ padding: '.5rem 1rem .5rem 1.5rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: TASK_STATUS_COLOR[task.status] ?? '#94A3B8', flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '.8125rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isOverdue ? 'var(--danger)' : 'var(--text)' }}>
                                {task.title}
                              </div>
                              {(task.estimated_hours || task.actual_hours) && (
                                <div style={{ fontSize: '.625rem', color: 'var(--subtle)' }}>
                                  {task.actual_hours ?? 0}h / {task.estimated_hours ?? '?'}h
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ position: 'relative', height: 40 }}>
                            {startPct !== null && width !== null && (
                              <div style={{ position: 'absolute', left: `${startPct}%`, width: `${width}%`, top: '50%', transform: 'translateY(-50%)', height: 16, borderRadius: 4, background: task.status === 'completed' ? '#16A34A' : isOverdue ? '#DC2626' : SAP_PHASE_COLOR[ph] ?? '#0A6ED1', opacity: .85, minWidth: 4 }}>
                                {task.progress > 0 && (
                                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${task.progress}%`, background: 'rgba(255,255,255,.3)', borderRadius: 4 }} />
                                )}
                              </div>
                            )}
                            {!startPct && end && (
                              <div style={{ position: 'absolute', left: `${endPct ?? 0}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 10, height: 10, background: TASK_STATUS_COLOR[task.status], borderRadius: 2, rotate: '45deg' }} />
                            )}
                            <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 1, background: 'var(--danger)', opacity: .3 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {/* Tasks without SAP phase */}
              {filtered.filter(t => !t.sap_activate_phase).map(task => {
                const start = task.start_date ? new Date(task.start_date) : null
                const end   = task.due_date   ? new Date(task.due_date)   : null
                const startPct = start ? Math.min(99, Math.max(0, (dayOffset(start) / totalDays) * 100)) : null
                const endPct   = end   ? Math.min(100, Math.max(0, (dayOffset(end)   / totalDays) * 100)) : null
                const width    = startPct !== null && endPct !== null ? Math.max(0.5, endPct - startPct) : null
                const isOverdue = end && end < today && task.status !== 'completed'
                return (
                  <div key={task.id} style={{ display: 'grid', gridTemplateColumns: '240px 1fr', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div style={{ padding: '.5rem 1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: TASK_STATUS_COLOR[task.status] ?? '#94A3B8', flexShrink: 0 }} />
                      <div style={{ fontSize: '.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isOverdue ? 'var(--danger)' : 'var(--text)' }}>{task.title}</div>
                    </div>
                    <div style={{ position: 'relative', height: 40 }}>
                      {startPct !== null && width !== null && (
                        <div style={{ position: 'absolute', left: `${startPct}%`, width: `${width}%`, top: '50%', transform: 'translateY(-50%)', height: 14, borderRadius: 4, background: isOverdue ? '#DC2626' : '#0A6ED1', opacity: .8, minWidth: 4 }} />
                      )}
                      <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 1, background: 'var(--danger)', opacity: .3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={{ padding: '.75rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '1rem', flexWrap: 'wrap', background: 'var(--surface-2)' }}>
            <span style={{ fontSize: '.6875rem', color: 'var(--subtle)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Legenda:</span>
            {[
              { color: '#16A34A', label: 'Concluído' },
              { color: '#0A6ED1', label: 'Em andamento' },
              { color: '#DC2626', label: 'Atrasado' },
              { color: '#94A3B8', label: 'A fazer' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '.375rem', fontSize: '.75rem', color: 'var(--text-2)' }}>
                <div style={{ width: 20, height: 8, borderRadius: 2, background: l.color }} />
                {l.label}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '.375rem', fontSize: '.75rem', color: 'var(--danger)' }}>
              <div style={{ width: 2, height: 12, background: 'var(--danger)' }} />
              Hoje
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.375rem', fontSize: '.75rem', color: 'var(--text-2)' }}>
              <div style={{ width: 10, height: 10, background: '#0A6ED1', rotate: '45deg', borderRadius: 1 }} />
              Marco
            </div>
          </div>
        </div>
      ) : (
        /* ── LIST VIEW ───────────────────────────────────── */
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tarefa</th><th>Fase SAP</th><th>Status</th>
                <th>Início</th><th>Fim</th><th>Horas est.</th><th>Progresso</th>
              </tr>
            </thead>
            <tbody>
              {/* Milestones first */}
              {milestones.map(m => (
                <tr key={m.id} style={{ background: 'var(--surface-2)' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                      <span>🔷</span>
                      <span style={{ fontWeight: 700, fontSize: '.875rem' }}>{m.name}</span>
                      <span className="badge">Marco</span>
                    </div>
                  </td>
                  <td>—</td>
                  <td>
                    <span className="badge" style={{ background: (STATUS_COLOR[m.status] ?? '#94A3B8') + '22', color: STATUS_COLOR[m.status] ?? '#94A3B8', borderColor: (STATUS_COLOR[m.status] ?? '#94A3B8') + '44' }}>
                      {m.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>—</td>
                  <td style={{ fontWeight: 600, color: new Date(m.due_date) < today ? 'var(--danger)' : 'var(--text)' }}>
                    {new Date(m.due_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td>—</td>
                  <td>—</td>
                </tr>
              ))}
              {/* Tasks */}
              {filtered.map(task => (
                <tr key={task.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: TASK_STATUS_COLOR[task.status] ?? '#94A3B8', flexShrink: 0 }} />
                      <span style={{ fontSize: '.875rem', fontWeight: 500 }}>{task.title}</span>
                    </div>
                  </td>
                  <td>
                    {task.sap_activate_phase ? (
                      <span className="badge" style={{ background: (SAP_PHASE_COLOR[task.sap_activate_phase] ?? '#94A3B8') + '22', color: SAP_PHASE_COLOR[task.sap_activate_phase] ?? '#94A3B8' }}>
                        {task.sap_activate_phase}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <span className="badge" style={{ background: (TASK_STATUS_COLOR[task.status] ?? '#94A3B8') + '22', color: TASK_STATUS_COLOR[task.status] ?? '#94A3B8' }}>
                      {task.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ fontSize: '.8125rem', color: 'var(--subtle)' }}>
                    {task.start_date ? new Date(task.start_date).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td style={{ fontSize: '.8125rem', color: task.due_date && new Date(task.due_date) < today && task.status !== 'completed' ? 'var(--danger)' : 'var(--text-2)' }}>
                    {task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td style={{ fontSize: '.8125rem', color: 'var(--subtle)' }}>
                    {task.estimated_hours ?? '—'}
                  </td>
                  <td>
                    {task.progress > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                        <div style={{ flex: 1, height: 5, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
                          <div style={{ width: `${task.progress}%`, height: '100%', background: 'var(--brand)', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: '.6875rem', fontWeight: 700, color: 'var(--subtle)' }}>{task.progress}%</span>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && canEdit && (
        <p style={{ fontSize: '.75rem', color: 'var(--subtle-2)', marginTop: '.875rem' }}>
          💡 Para ver barras no Gantt, adicione datas de início e fim nas tarefas via Kanban.
        </p>
      )}
    </div>
  )
}
