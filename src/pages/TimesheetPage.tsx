import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getProjects } from '../lib/api'
import { getMyResource, getTimesheets, createTimesheet, approveTimesheet, rejectTimesheet } from '../lib/resources'
import type { Timesheet } from '../lib/resources'
import { toast } from '../components/Toast'
import { newReportDoc, addReportTable, footerAndSave } from '../lib/pdf'
import { useAuth } from '../contexts/AuthContext'
import type { Project, Task } from '../types/app.types'

type TS = Timesheet & {
  resource?: { id: string; profile: { id: string; full_name: string | null } | null } | null
  project?: { id: string; name: string; code: string } | null
  task?: { id: string; title: string } | null
}

type DerivedStatus = 'submitted' | 'approved' | 'rejected'

const STATUS_CFG: Record<DerivedStatus, { label: string; color: string; bg: string }> = {
  submitted: { label: 'Aguardando', color: '#2563EB', bg: '#DBEAFE' },
  approved:  { label: 'Aprovado',   color: '#16A34A', bg: '#DCFCE7' },
  rejected:  { label: 'Rejeitado',  color: '#DC2626', bg: '#FEE2E2' },
}

type Range = 'semana' | 'mes' | 'personalizado'

type Props = { userId: string; role: string }

function tsStatus(t: TS): DerivedStatus {
  if (t.rejected_at) return 'rejected'
  if (t.approved_at) return 'approved'
  return 'submitted'
}
function extractError(err: unknown): string {
  if (!err) return 'Erro desconhecido.'
  if (typeof err === 'string') return err
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e['message'] === 'string') return e['message']
  }
  return 'Erro desconhecido.'
}
function fmtDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') }
function dayOfWeek(d: string) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return days[new Date(d + 'T12:00:00').getDay()]
}
function toISODate(d: Date) { return d.toISOString().slice(0, 10) }
function weekStart(date = new Date()) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay() + 1)
  return toISODate(d)
}
function weekEnd(date = new Date()) {
  const d = new Date(weekStart(date) + 'T12:00:00')
  d.setDate(d.getDate() + 6)
  return toISODate(d)
}
function monthStart(date = new Date()) { return toISODate(new Date(date.getFullYear(), date.getMonth(), 1)) }
function monthEnd(date = new Date())   { return toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0)) }

export default function TimesheetPage({ userId, role }: Props) {
  const { profile } = useAuth()
  const [timesheets, setTimesheets] = useState<TS[]>([])
  const [projects,   setProjects]   = useState<Project[]>([])
  const [tasks,      setTasks]      = useState<Task[]>([])
  const [myResourceId, setMyResourceId] = useState<string | null>(null)
  const [resourceLoading, setResourceLoading] = useState(true)
  const [loading,    setLoading]    = useState(true)
  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterProj,     setFilterProj]     = useState('')
  const [filterResource, setFilterResource] = useState('')
  const [range,       setRange]       = useState<Range>('mes')
  const [customStart, setCustomStart] = useState(monthStart())
  const [customEnd,   setCustomEnd]   = useState(monthEnd())
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [rejecting,  setRejecting]  = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showReport, setShowReport] = useState(false)
  const [resourceOptions, setResourceOptions] = useState<[string, string][]>([])
  // form
  const [fDate,  setFDate]  = useState(toISODate(new Date()))
  const [fHours, setFHours] = useState('8')
  const [fProj,  setFProj]  = useState('')
  const [fTask,  setFTask]  = useState('')
  const [fDesc,  setFDesc]  = useState('')

  const isManager = ['admin', 'manager'].includes(role)

  function currentRange(): { start: string; end: string } {
    if (range === 'semana')  return { start: weekStart(), end: weekEnd() }
    if (range === 'mes')     return { start: monthStart(), end: monthEnd() }
    return { start: customStart, end: customEnd }
  }

  async function load(resourceId: string | null) {
    if (!isManager && !resourceId) { setTimesheets([]); setLoading(false); return }
    setLoading(true)
    const { start, end } = currentRange()
    const filters: { resourceId?: string; projectId?: string; startDate?: string; endDate?: string } = {
      startDate: start, endDate: end,
    }
    if (filterProj) filters.projectId = filterProj
    if (!isManager && resourceId) filters.resourceId = resourceId
    const { data, error } = await getTimesheets(filters)
    if (error) { toast(extractError(error), 'error'); setLoading(false); return }
    let rows = (data ?? []) as TS[]
    if (isManager) {
      setResourceOptions(Array.from(
        new Map(rows.filter(t => t.resource?.profile?.full_name).map(t => [t.resource_id as string, t.resource!.profile!.full_name!])).entries(),
      ))
    }
    if (filterStatus) rows = rows.filter(t => tsStatus(t) === filterStatus)
    if (filterResource) rows = rows.filter(t => t.resource_id === filterResource)
    setTimesheets(rows)
    setLoading(false)
  }

  async function loadTasks(projId: string) {
    if (!projId) { setTasks([]); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from('tasks').select('id,title,status').eq('project_id', projId).neq('status', 'cancelled')
    setTasks(data ?? [])
  }

  useEffect(() => {
    getMyResource(userId).then(({ data }) => {
      setMyResourceId(data?.id ?? null)
      setResourceLoading(false)
    })
    getProjects().then(({ data }) => setProjects(data ?? []))
  }, [userId])

  useEffect(() => {
    if (resourceLoading) return
    void load(myResourceId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceLoading, myResourceId, filterStatus, filterProj, filterResource, range, customStart, customEnd])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fDate || !fHours || !fProj) return
    if (!myResourceId) { toast('Você não está cadastrado como recurso — fale com seu gestor.', 'error'); return }
    setSaving(true)
    const { error } = await createTimesheet({
      organization_id: profile?.organization_id ?? undefined,
      resource_id: myResourceId,
      project_id: fProj,
      task_id: fTask || null,
      date: fDate,
      hours: parseFloat(fHours),
      description: fDesc.trim() || null,
    })
    if (error) { toast(extractError(error), 'error') }
    else {
      toast('Apontamento lançado!', 'ok')
      setFDate(toISODate(new Date())); setFHours('8'); setFProj(''); setFTask(''); setFDesc(''); setShowForm(false)
      void load(myResourceId)
    }
    setSaving(false)
  }

  async function handleApprove(id: string) {
    const { error } = await approveTimesheet(id, userId)
    if (error) toast(extractError(error), 'error')
    else { toast('Aprovado!', 'ok'); void load(myResourceId) }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return
    const { error } = await rejectTimesheet(id, userId, rejectReason.trim())
    if (error) toast(extractError(error), 'error')
    else { toast('Rejeitado.', 'warn'); setRejecting(null); setRejectReason(''); void load(myResourceId) }
  }

  // KPIs
  const totalHoras = timesheets.reduce((s, t) => s + Number(t.hours), 0)
  const horasAprov = timesheets.filter(t => tsStatus(t) === 'approved').reduce((s, t) => s + Number(t.hours), 0)
  const horasPend  = timesheets.filter(t => tsStatus(t) === 'submitted').reduce((s, t) => s + Number(t.hours), 0)
  const horasRej   = timesheets.filter(t => tsStatus(t) === 'rejected').reduce((s, t) => s + Number(t.hours), 0)

  const projMap = Object.fromEntries(projects.map(p => [p.id, p]))

  // Group by week
  const byWeek: Record<string, TS[]> = {}
  timesheets.forEach(t => {
    const wk = weekStart(new Date(t.date + 'T12:00:00'))
    if (!byWeek[wk]) byWeek[wk] = []
    byWeek[wk].push(t)
  })
  const weeks = Object.keys(byWeek).sort().reverse()

  // Relatório de horas por projeto (respeita o período/filtros ativos)
  type ProjRow = { projectId: string; code: string; name: string; total: number; aprov: number; pend: number; rej: number }
  const byProject: Record<string, ProjRow> = {}
  timesheets.forEach(t => {
    const pid = t.project_id ?? '—'
    const proj = t.project_id ? projMap[t.project_id] : null
    if (!byProject[pid]) byProject[pid] = { projectId: pid, code: proj?.code ?? '—', name: proj?.name ?? 'Sem projeto', total: 0, aprov: 0, pend: 0, rej: 0 }
    const row = byProject[pid]
    row.total += Number(t.hours)
    const st = tsStatus(t)
    if (st === 'approved') row.aprov += Number(t.hours)
    else if (st === 'submitted') row.pend += Number(t.hours)
    else row.rej += Number(t.hours)
  })
  const projectRows = Object.values(byProject).sort((a, b) => b.total - a.total)

  // Relatório de horas por recurso (só faz sentido para quem vê todos os apontamentos)
  type ResRow = { resourceId: string; name: string; total: number; aprov: number; pend: number; rej: number }
  const byResource: Record<string, ResRow> = {}
  timesheets.forEach(t => {
    const rid = t.resource_id ?? '—'
    if (!byResource[rid]) byResource[rid] = { resourceId: rid, name: t.resource?.profile?.full_name ?? 'Desconhecido', total: 0, aprov: 0, pend: 0, rej: 0 }
    const row = byResource[rid]
    row.total += Number(t.hours)
    const st = tsStatus(t)
    if (st === 'approved') row.aprov += Number(t.hours)
    else if (st === 'submitted') row.pend += Number(t.hours)
    else row.rej += Number(t.hours)
  })
  const resourceRows = Object.values(byResource).sort((a, b) => b.total - a.total)

  function exportProjectCsv() {
    const { start, end } = currentRange()
    const lines = [
      'Projeto;Código;Total (h);Aprovadas (h);Pendentes (h);Rejeitadas (h)',
      ...projectRows.map(r => `${r.name};${r.code};${r.total.toFixed(1)};${r.aprov.toFixed(1)};${r.pend.toFixed(1)};${r.rej.toFixed(1)}`),
    ].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines)
    a.download = `horas_por_projeto_${start}_a_${end}.csv`
    a.click()
  }

  function exportResourceCsv() {
    const { start, end } = currentRange()
    const lines = [
      'Recurso;Total (h);Aprovadas (h);Pendentes (h);Rejeitadas (h)',
      ...resourceRows.map(r => `${r.name};${r.total.toFixed(1)};${r.aprov.toFixed(1)};${r.pend.toFixed(1)};${r.rej.toFixed(1)}`),
    ].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines)
    a.download = `horas_por_recurso_${start}_a_${end}.csv`
    a.click()
  }

  function exportPdf() {
    const { start, end } = currentRange()
    const doc = newReportDoc('Relatório de Horas', `Período: ${fmtDate(start)} a ${fmtDate(end)}`)
    addReportTable(doc, ['Projeto', 'Total (h)', 'Aprovadas', 'Pendentes', 'Rejeitadas'],
      projectRows.map(r => [r.name, r.total.toFixed(1), r.aprov.toFixed(1), r.pend.toFixed(1), r.rej.toFixed(1)]))
    if (isManager && resourceRows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const finalY = ((doc as any).lastAutoTable?.finalY ?? 45) + 10
      doc.setFontSize(11); doc.text('Horas por recurso', 10, finalY)
      addReportTable(doc, ['Recurso', 'Total (h)', 'Aprovadas', 'Pendentes', 'Rejeitadas'],
        resourceRows.map(r => [r.name, r.total.toFixed(1), r.aprov.toFixed(1), r.pend.toFixed(1), r.rej.toFixed(1)]),
        finalY + 5)
    }
    footerAndSave(doc, `horas_${start}_a_${end}.pdf`)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">Execução</div>
          <h1>Timesheet</h1>
          <p className="page-header__sub">Apontamento e aprovação de horas</p>
        </div>
        <div className="page-header__actions">
          {myResourceId && (
            <button onClick={() => setShowForm(v => !v)}>
              {showForm ? '✕ Cancelar' : '+ Lançar horas'}
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total de horas', val: totalHoras.toFixed(1) + 'h', icon: '⏱', cls: 'brand' },
          { label: 'Aprovadas',      val: horasAprov.toFixed(1) + 'h', icon: '✅', cls: 'ok' },
          { label: 'Pendentes',      val: horasPend.toFixed(1) + 'h',  icon: '⏳', cls: 'warn' },
          { label: 'Rejeitadas',     val: horasRej.toFixed(1) + 'h',   icon: '❌', cls: 'danger' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-card__top">
              <div>
                <div className="kpi-card__label">{k.label}</div>
                <div className="kpi-card__value" style={{ fontSize: '1.375rem' }}>{k.val}</div>
              </div>
              <div className={`kpi-card__icon kpi-card__icon--${k.cls}`}>{k.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {!resourceLoading && !myResourceId && !isManager && (
        <div className="empty-state" style={{ marginBottom: '1.25rem' }}>
          <div className="empty-state__icon">ℹ️</div>
          <div className="empty-state__title">Você ainda não está cadastrado como recurso</div>
          <p className="empty-state__desc">Fale com seu gestor para lançar apontamentos de horas.</p>
        </div>
      )}

      {/* Form */}
      {showForm && myResourceId && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
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
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Descrição da atividade</label>
                  <textarea rows={2} value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="O que foi feito…" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" disabled={saving}>{saving ? 'Lançando…' : '✓ Lançar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '.25rem' }}>
          {(['semana', 'mes', 'personalizado'] as Range[]).map(r => (
            <button key={r} className={range === r ? 'btn-sm' : 'btn-ghost btn-sm'} onClick={() => setRange(r)}>
              {r === 'semana' ? 'Esta semana' : r === 'mes' ? 'Este mês' : 'Personalizado'}
            </button>
          ))}
        </div>
        {range === 'personalizado' && (
          <>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ width: 'auto', fontSize: '.8125rem' }} />
            <span style={{ color: 'var(--subtle)' }}>até</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ width: 'auto', fontSize: '.8125rem' }} />
          </>
        )}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 'auto', fontSize: '.8125rem' }}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        {isManager && (
          <>
            <select value={filterProj} onChange={e => setFilterProj(e.target.value)} style={{ width: 'auto', fontSize: '.8125rem' }}>
              <option value="">Todos os projetos</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
            <select value={filterResource} onChange={e => setFilterResource(e.target.value)} style={{ width: 'auto', fontSize: '.8125rem' }}>
              <option value="">Todos os recursos</option>
              {resourceOptions.map(([rid, name]) => <option key={rid} value={rid}>{name}</option>)}
            </select>
          </>
        )}
        {(filterStatus || filterProj || filterResource) && (
          <button className="btn-ghost btn-sm" onClick={() => { setFilterStatus(''); setFilterProj(''); setFilterResource('') }}>Limpar</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: 'var(--subtle)' }}>{timesheets.length} registro{timesheets.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Relatório de horas por projeto */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card__header">
          <span className="card__title">📊 Relatório de horas por projeto</span>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button className="btn-ghost btn-sm" onClick={() => setShowReport(v => !v)}>{showReport ? 'Ocultar' : 'Mostrar'}</button>
            <button className="btn-secondary btn-sm" onClick={exportProjectCsv} disabled={projectRows.length === 0}>⬇ CSV</button>
            <button className="btn-secondary btn-sm" onClick={exportPdf} disabled={projectRows.length === 0}>📄 PDF</button>
          </div>
        </div>
        {showReport && (
          <div className="card__body" style={{ padding: 0 }}>
            {projectRows.length === 0 ? (
              <p className="empty-state__desc" style={{ padding: '1rem 1.25rem' }}>Nenhum apontamento no período selecionado.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Projeto</th><th>Total</th><th>Aprovadas</th><th>Pendentes</th><th>Rejeitadas</th></tr>
                  </thead>
                  <tbody>
                    {projectRows.map(r => (
                      <tr key={r.projectId}>
                        <td><span className="badge badge--brand">{r.code}</span> {r.name}</td>
                        <td style={{ fontWeight: 700 }}>{r.total.toFixed(1)}h</td>
                        <td style={{ color: 'var(--ok)' }}>{r.aprov.toFixed(1)}h</td>
                        <td style={{ color: 'var(--warn)' }}>{r.pend.toFixed(1)}h</td>
                        <td style={{ color: 'var(--danger)' }}>{r.rej.toFixed(1)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Relatório de horas por recurso (gestores) */}
      {isManager && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card__header">
            <span className="card__title">🧑‍💼 Relatório de horas por recurso</span>
            <button className="btn-secondary btn-sm" onClick={exportResourceCsv} disabled={resourceRows.length === 0}>⬇ CSV</button>
          </div>
          {showReport && (
            <div className="card__body" style={{ padding: 0 }}>
              {resourceRows.length === 0 ? (
                <p className="empty-state__desc" style={{ padding: '1rem 1.25rem' }}>Nenhum apontamento no período selecionado.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Recurso</th><th>Total</th><th>Aprovadas</th><th>Pendentes</th><th>Rejeitadas</th></tr>
                    </thead>
                    <tbody>
                      {resourceRows.map(r => (
                        <tr key={r.resourceId}>
                          <td>{r.name}</td>
                          <td style={{ fontWeight: 700 }}>{r.total.toFixed(1)}h</td>
                          <td style={{ color: 'var(--ok)' }}>{r.aprov.toFixed(1)}h</td>
                          <td style={{ color: 'var(--warn)' }}>{r.pend.toFixed(1)}h</td>
                          <td style={{ color: 'var(--danger)' }}>{r.rej.toFixed(1)}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lista agrupada por semana */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 80, borderRadius: 'var(--r-lg)' }} className="skeleton" />)}
        </div>
      ) : timesheets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">⏱</div>
          <div className="empty-state__title">Nenhum apontamento no período</div>
          <p className="empty-state__desc">
            {myResourceId ? 'Clique em "+ Lançar horas" para registrar um apontamento.' : 'Ajuste os filtros de período para ver outros lançamentos.'}
          </p>
        </div>
      ) : (
        weeks.map(wk => {
          const items = byWeek[wk]
          const wkTotal = items.reduce((s, t) => s + Number(t.hours), 0)
          const wkEnd = new Date(wk + 'T12:00:00')
          wkEnd.setDate(wkEnd.getDate() + 6)
          return (
            <div key={wk} style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.5rem' }}>
                <span style={{ fontSize: '.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--subtle)' }}>
                  Semana {fmtDate(wk)} – {fmtDate(toISODate(wkEnd))}
                </span>
                <span className="badge badge--brand">{wkTotal.toFixed(1)}h</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Dia</th><th>Data</th>{isManager && <th>Recurso</th>}<th>Projeto</th><th>Horas</th>
                      <th>Descrição</th><th>Status</th><th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.sort((a, b) => a.date.localeCompare(b.date)).map(ts => {
                      const st = tsStatus(ts)
                      const cfg = STATUS_CFG[st]
                      const proj = ts.project_id ? projMap[ts.project_id] : null
                      return (
                        <>
                          <tr key={ts.id}>
                            <td style={{ fontWeight: 600, color: 'var(--subtle)' }}>{dayOfWeek(ts.date)}</td>
                            <td style={{ fontSize: '.875rem' }}>{fmtDate(ts.date)}</td>
                            {isManager && <td style={{ fontSize: '.8125rem' }}>{ts.resource?.profile?.full_name ?? '—'}</td>}
                            <td>{proj ? <span className="badge badge--brand">{proj.code}</span> : '—'}</td>
                            <td style={{ fontWeight: 700, fontSize: '1rem' }}>{Number(ts.hours)}h</td>
                            <td style={{ fontSize: '.8125rem', color: 'var(--subtle)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ts.description ?? '—'}
                            </td>
                            <td>
                              <span className="badge" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.color + '33' }}>
                                {cfg.label}
                              </span>
                            </td>
                            <td>
                              {isManager && st === 'submitted' && (
                                <div style={{ display: 'flex', gap: '.25rem' }}>
                                  <button className="btn-sm btn-ok" onClick={() => handleApprove(ts.id)}>✓</button>
                                  <button className="btn-sm btn-danger" onClick={() => setRejecting(rejecting === ts.id ? null : ts.id)}>✗</button>
                                </div>
                              )}
                            </td>
                          </tr>
                          {rejecting === ts.id && (
                            <tr key={`rej-${ts.id}`}>
                              <td colSpan={isManager ? 8 : 7} style={{ background: 'var(--danger-bg)', padding: '.75rem 1rem' }}>
                                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                                  <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                    placeholder="Motivo da rejeição…" style={{ flex: 1, fontSize: '.875rem' }} />
                                  <button className="btn-sm btn-danger" onClick={() => handleReject(ts.id)}>Confirmar</button>
                                  <button className="btn-ghost btn-sm" onClick={() => { setRejecting(null); setRejectReason('') }}>Cancelar</button>
                                </div>
                              </td>
                            </tr>
                          )}
                          {st === 'rejected' && ts.rejection_reason && (
                            <tr key={`rr-${ts.id}`}>
                              <td colSpan={isManager ? 8 : 7} style={{ background: 'var(--danger-bg)', fontSize: '.75rem', color: 'var(--danger)', padding: '.375rem 1rem' }}>
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
