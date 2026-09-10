import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getProjects } from '../lib/api'
import { toast } from '../components/Toast'
import type { Project, Task } from '../types/app.types'

type TS = {
  id: string; resource_id: string | null; project_id: string | null
  task_id: string | null; work_date: string; hours: number
  description: string | null; status: string
  approved_by: string | null; approved_at: string | null
  rejected_by: string | null; rejection_reason: string | null
  week_start: string | null; created_at: string
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label:'Rascunho',   color:'#64748B', bg:'#F1F5F9' },
  submitted: { label:'Aguardando', color:'#2563EB', bg:'#DBEAFE' },
  approved:  { label:'Aprovado',   color:'#16A34A', bg:'#DCFCE7' },
  rejected:  { label:'Rejeitado',  color:'#DC2626', bg:'#FEE2E2' },
}

type Props = { userId: string; role: string }

function weekStart(date = new Date()) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay() + 1)
  return d.toISOString().slice(0, 10)
}
function fmtDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') }
function dayOfWeek(d: string) {
  const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  return days[new Date(d + 'T12:00:00').getDay()]
}

export default function TimesheetPage({ userId, role }: Props) {
  const [timesheets, setTimesheets] = useState<TS[]>([])
  const [projects,   setProjects]   = useState<Project[]>([])
  const [tasks,      setTasks]      = useState<Task[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filterStatus,setFilterStatus] = useState('')
  const [filterProj,  setFilterProj]   = useState('')
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [rejecting,  setRejecting]  = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  // form
  const [fDate,  setFDate]  = useState(new Date().toISOString().slice(0,10))
  const [fHours, setFHours] = useState('8')
  const [fProj,  setFProj]  = useState('')
  const [fTask,  setFTask]  = useState('')
  const [fDesc,  setFDesc]  = useState('')

  const sb = supabase as any
  const isManager = ['admin','manager'].includes(role)

  async function load() {
    setLoading(true)
    let q = sb.from('timesheets').select('*').order('work_date', { ascending: false })
    if (!isManager) q = q.or(`resource_id.eq.${userId},created_by.eq.${userId}`)
    if (filterStatus) q = q.eq('status', filterStatus)
    if (filterProj)   q = q.eq('project_id', filterProj)
    const { data } = await q.limit(200)
    setTimesheets(data ?? [])
    setLoading(false)
  }

  async function loadTasks(projId: string) {
    if (!projId) { setTasks([]); return }
    const { data } = await sb.from('tasks').select('id,title,status').eq('project_id', projId).neq('status','cancelled')
    setTasks(data ?? [])
  }

  useEffect(() => { void load() }, [filterStatus, filterProj])
  useEffect(() => { getProjects().then(({ data }) => setProjects(data ?? [])) }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fDate || !fHours || !fProj) return
    setSaving(true)
    const { error } = await sb.from('timesheets').insert({
      project_id: fProj || null,
      task_id:    fTask || null,
      work_date:  fDate,
      hours:      parseFloat(fHours),
      description: fDesc.trim() || null,
      status:     'submitted',
      week_start: weekStart(new Date(fDate + 'T12:00:00')),
    })
    if (error) { toast(error.message, 'error') }
    else { toast('Apontamento lançado!', 'ok'); setFDate(new Date().toISOString().slice(0,10)); setFHours('8'); setFProj(''); setFTask(''); setFDesc(''); setShowForm(false); void load() }
    setSaving(false)
  }

  async function handleApprove(id: string) {
    const { error } = await sb.from('timesheets').update({ status:'approved', approved_by: userId, approved_at: new Date().toISOString() }).eq('id', id)
    if (error) toast(error.message, 'error')
    else { toast('Aprovado!', 'ok'); void load() }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return
    const { error } = await sb.from('timesheets').update({ status:'rejected', rejected_by: userId, rejected_at: new Date().toISOString(), rejection_reason: rejectReason.trim() }).eq('id', id)
    if (error) toast(error.message, 'error')
    else { toast('Rejeitado.', 'warn'); setRejecting(null); setRejectReason(''); void load() }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este apontamento?')) return
    await sb.from('timesheets').delete().eq('id', id)
    toast('Removido.', 'warn'); void load()
  }

  // KPIs
  const totalHoras  = timesheets.reduce((s, t) => s + t.hours, 0)
  const horasAprov  = timesheets.filter(t => t.status === 'approved').reduce((s,t) => s + t.hours, 0)
  const horasPend   = timesheets.filter(t => t.status === 'submitted').reduce((s,t) => s + t.hours, 0)
  const horasRej    = timesheets.filter(t => t.status === 'rejected').reduce((s,t) => s + t.hours, 0)

  const projMap = Object.fromEntries(projects.map(p => [p.id, p]))

  // Group by week
  const byWeek: Record<string, TS[]> = {}
  timesheets.forEach(t => {
    const wk = t.week_start ?? weekStart(new Date(t.work_date + 'T12:00:00'))
    if (!byWeek[wk]) byWeek[wk] = []
    byWeek[wk].push(t)
  })
  const weeks = Object.keys(byWeek).sort().reverse()

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">Execução</div>
          <h1>Timesheet</h1>
          <p className="page-header__sub">Apontamento e aprovação de horas</p>
        </div>
        <div className="page-header__actions">
          <button onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Cancelar' : '+ Lançar horas'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', marginBottom:'1.5rem' }}>
        {[
          { label:'Total de horas', val: totalHoras.toFixed(1)+'h', icon:'⏱', cls:'brand' },
          { label:'Aprovadas',      val: horasAprov.toFixed(1)+'h', icon:'✅', cls:'ok' },
          { label:'Pendentes',      val: horasPend.toFixed(1)+'h',  icon:'⏳', cls:'warn' },
          { label:'Rejeitadas',     val: horasRej.toFixed(1)+'h',   icon:'❌', cls:'danger' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-card__top">
              <div>
                <div className="kpi-card__label">{k.label}</div>
                <div className="kpi-card__value" style={{ fontSize:'1.375rem' }}>{k.val}</div>
              </div>
              <div className={`kpi-card__icon kpi-card__icon--${k.cls}`}>{k.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ marginBottom:'1.25rem' }}>
          <div className="card__header"><span className="card__title">Novo apontamento</span></div>
          <div className="card__body">
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Data *</label>
                  <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Horas *</label>
                  <input type="number" value={fHours} onChange={e => setFHours(e.target.value)} min={0.5} max={24} step={0.5} required />
                </div>
                <div className="form-group">
                  <label>Projeto *</label>
                  <select value={fProj} onChange={e => { setFProj(e.target.value); setFTask(''); void loadTasks(e.target.value) }} required>
                    <option value="">— Selecione —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Tarefa</label>
                  <select value={fTask} onChange={e => setFTask(e.target.value)} disabled={!fProj}>
                    <option value="">— Nenhuma —</option>
                    {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label>Descrição da atividade</label>
                  <textarea rows={2} value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="O que foi feito…" />
                </div>
              </div>
              <div style={{ display:'flex', gap:'.5rem', justifyContent:'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" disabled={saving}>{saving ? 'Lançando…' : '✓ Lançar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="filter-bar">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width:'auto', fontSize:'.8125rem' }}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CFG).map(([v,c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={filterProj} onChange={e => setFilterProj(e.target.value)} style={{ width:'auto', fontSize:'.8125rem' }}>
          <option value="">Todos os projetos</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
        </select>
        {(filterStatus || filterProj) && (
          <button className="btn-ghost btn-sm" onClick={() => { setFilterStatus(''); setFilterProj('') }}>Limpar</button>
        )}
        <span style={{ marginLeft:'auto', fontSize:'.75rem', color:'var(--subtle)' }}>{timesheets.length} registro{timesheets.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Lista agrupada por semana */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
          {[1,2,3].map(i => <div key={i} style={{ height:80, borderRadius:'var(--r-lg)' }} className="skeleton" />)}
        </div>
      ) : timesheets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">⏱</div>
          <div className="empty-state__title">Nenhum apontamento</div>
          <p className="empty-state__desc">Clique em "+ Lançar horas" para registrar seu primeiro apontamento.</p>
        </div>
      ) : (
        weeks.map(wk => {
          const items = byWeek[wk]
          const wkTotal = items.reduce((s, t) => s + t.hours, 0)
          const wkEnd = new Date(wk + 'T12:00:00')
          wkEnd.setDate(wkEnd.getDate() + 6)
          return (
            <div key={wk} style={{ marginBottom:'1.5rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'.5rem' }}>
                <span style={{ fontSize:'.6875rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--subtle)' }}>
                  Semana {fmtDate(wk)} – {fmtDate(wkEnd.toISOString().slice(0,10))}
                </span>
                <span className="badge badge--brand">{wkTotal.toFixed(1)}h</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Dia</th><th>Data</th><th>Projeto</th><th>Horas</th>
                      <th>Descrição</th><th>Status</th><th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.sort((a,b) => a.work_date.localeCompare(b.work_date)).map(ts => {
                      const cfg = STATUS_CFG[ts.status] ?? STATUS_CFG.draft
                      const proj = ts.project_id ? projMap[ts.project_id] : null
                      const canAct = isManager || ts.status === 'draft' || ts.status === 'rejected'
                      return (
                        <>
                          <tr key={ts.id}>
                            <td style={{ fontWeight:600, color:'var(--subtle)' }}>{dayOfWeek(ts.work_date)}</td>
                            <td style={{ fontSize:'.875rem' }}>{fmtDate(ts.work_date)}</td>
                            <td>{proj ? <span className="badge badge--brand">{proj.code}</span> : '—'}</td>
                            <td style={{ fontWeight:700, fontSize:'1rem' }}>{ts.hours}h</td>
                            <td style={{ fontSize:'.8125rem', color:'var(--subtle)', maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {ts.description ?? '—'}
                            </td>
                            <td>
                              <span className="badge" style={{ background:cfg.bg, color:cfg.color, borderColor:cfg.color+'33' }}>
                                {cfg.label}
                              </span>
                            </td>
                            <td>
                              <div style={{ display:'flex', gap:'.25rem' }}>
                                {isManager && ts.status === 'submitted' && (
                                  <>
                                    <button className="btn-sm btn-ok" onClick={() => handleApprove(ts.id)}>✓</button>
                                    <button className="btn-sm btn-danger" onClick={() => setRejecting(rejecting === ts.id ? null : ts.id)}>✗</button>
                                  </>
                                )}
                                {canAct && ts.status !== 'approved' && (
                                  <button className="btn-ghost btn-sm" onClick={() => handleDelete(ts.id)} style={{ color:'var(--danger)', fontSize:'.625rem' }}>🗑</button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {rejecting === ts.id && (
                            <tr key={`rej-${ts.id}`}>
                              <td colSpan={7} style={{ background:'var(--danger-bg)', padding:'.75rem 1rem' }}>
                                <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
                                  <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                    placeholder="Motivo da rejeição…" style={{ flex:1, fontSize:'.875rem' }} />
                                  <button className="btn-sm btn-danger" onClick={() => handleReject(ts.id)}>Confirmar</button>
                                  <button className="btn-ghost btn-sm" onClick={() => { setRejecting(null); setRejectReason('') }}>Cancelar</button>
                                </div>
                              </td>
                            </tr>
                          )}
                          {ts.status === 'rejected' && ts.rejection_reason && (
                            <tr key={`rr-${ts.id}`}>
                              <td colSpan={7} style={{ background:'var(--danger-bg)', fontSize:'.75rem', color:'var(--danger)', padding:'.375rem 1rem' }}>
                                ✗ Rejeitado: {ts.rejection_reason}
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
