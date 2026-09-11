import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getMyResource, getAllocationsByResource, getTimesheets } from '../lib/resources'

type MyTask = {
  id:string; title:string; status:string; priority:string
  sap_activate_phase:string|null; due_date:string|null; project_id:string
  project:{ name:string; code:string }|null
}

type HoursRow = { projectId: string; code: string; name: string; planned: number; logged: number }

type MyProject = {
  id: string; name: string; code: string; status: string; priority: string
  progress: number; sap_module: string | null; end_date: string | null
  nextMilestone?: { name: string; due_date: string } | null
}

const PROJ_STATUS_LABEL: Record<string,string> = {
  draft:'Rascunho', active:'Ativo', on_hold:'Em espera', completed:'Concluído', cancelled:'Cancelado',
}
const PROJ_STATUS_COLOR: Record<string,string> = {
  draft:'#94A3B8', active:'#16A34A', on_hold:'#D97706', completed:'#1D4ED8', cancelled:'#DC2626',
}

function toISODate(d: Date) { return d.toISOString().slice(0, 10) }
function monthStart(d = new Date()) { return toISODate(new Date(d.getFullYear(), d.getMonth(), 1)) }
function monthEnd(d = new Date())   { return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }

const STATUS_LABEL: Record<string,string> = {
  todo:'A fazer', in_progress:'Em andamento', blocked:'Bloqueado',
  validation:'Validação', adjustment_required:'Ajuste', completed:'Concluído', cancelled:'Cancelado',
}
const STATUS_COLOR: Record<string,string> = {
  todo:'#94A3B8', in_progress:'#0A6ED1', blocked:'#DC2626',
  validation:'#F59E0B', adjustment_required:'#F59E0B', completed:'#16A34A', cancelled:'#94A3B8',
}
const PRIO_COLOR: Record<string,string> = {
  low:'#94A3B8', medium:'#F59E0B', high:'#EF4444', critical:'#7C3AED',
}

export default function ConsultantDashboard() {
  const { profile } = useAuth()
  const navigate     = useNavigate()
  const [tasks,    setTasks]    = useState<MyTask[]>([])
  const [loading,  setLoading]  = useState(true)
  const [hoursRows, setHoursRows] = useState<HoursRow[]>([])
  const [hoursLoading, setHoursLoading] = useState(true)
  const [myProjects, setMyProjects] = useState<MyProject[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  async function load() {
    setLoading(true)
    const { data } = await sb.from('tasks')
      .select('*, project:projects(name,code)')
      .eq('assignee_id', profile?.id)
      .not('status','in','(completed,cancelled)')
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true })
    setTasks(data ?? [])
    setLoading(false)
  }

  async function loadHours() {
    if (!profile?.id) return
    setHoursLoading(true)
    const { data: resource } = await getMyResource(profile.id)
    if (!resource) { setHoursRows([]); setHoursLoading(false); return }

    const today = new Date()
    const todayISO = toISODate(today)
    const [{ data: allocations }, { data: timesheets }] = await Promise.all([
      getAllocationsByResource(resource.id),
      getTimesheets({ resourceId: resource.id, startDate: monthStart(today), endDate: monthEnd(today) }),
    ])

    const rows: Record<string, HoursRow> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;((allocations ?? []) as any[])
      .filter(a => (!a.start_date || a.start_date <= todayISO) && (!a.end_date || a.end_date >= todayISO))
      .forEach(a => {
        const pid = a.project_id
        if (!rows[pid]) rows[pid] = { projectId: pid, code: a.project?.code ?? '—', name: a.project?.name ?? 'Projeto', planned: 0, logged: 0 }
        rows[pid].planned += Number(a.allocated_hours)
      })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;((timesheets ?? []) as any[]).forEach(t => {
      const pid = t.project_id
      if (!rows[pid]) rows[pid] = { projectId: pid, code: t.project?.code ?? '—', name: t.project?.name ?? 'Projeto', planned: 0, logged: 0 }
      rows[pid].logged += Number(t.hours)
    })
    setHoursRows(Object.values(rows).sort((a, b) => b.planned - a.planned))
    setHoursLoading(false)

    // Info dos projetos em que ele está alocado — status, prioridade, progresso,
    // módulo e próximo marco. NUNCA valores financeiros (budget/custo).
    const projectIds = Object.keys(rows)
    if (projectIds.length === 0) { setMyProjects([]); return }
    const [{ data: projRows }, { data: mileRows }] = await Promise.all([
      sb.from('projects').select('id,name,code,status,priority,progress,sap_module,end_date').in('id', projectIds),
      sb.from('milestones').select('project_id,name,due_date')
        .in('project_id', projectIds).in('status', ['not_started', 'in_progress'])
        .order('due_date'),
    ])
    const nextMileByProject: Record<string, { name: string; due_date: string }> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;((mileRows ?? []) as any[]).forEach(m => {
      if (!nextMileByProject[m.project_id]) nextMileByProject[m.project_id] = { name: m.name, due_date: m.due_date }
    })
    setMyProjects(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((projRows ?? []) as any[]).map(p => ({
        ...p, nextMilestone: nextMileByProject[p.id] ?? null,
      }))
    )
  }

  useEffect(() => { void load(); void loadHours() }, [])

  const totalPlanned = hoursRows.reduce((s, r) => s + r.planned, 0)
  const totalLogged  = hoursRows.reduce((s, r) => s + r.logged, 0)

  const byStatus: Record<string,MyTask[]> = {}
  tasks.forEach(t => {
    if (!byStatus[t.status]) byStatus[t.status] = []
    byStatus[t.status].push(t)
  })

  const statuses = ['blocked','in_progress','validation','adjustment_required','todo']

  // KPIs sem valores financeiros
  const totalAbertas = tasks.length
  const bloqueadas   = tasks.filter(t=>t.status==='blocked').length
  const emAndamento  = tasks.filter(t=>t.status==='in_progress').length
  const atrasadas    = tasks.filter(t=>t.due_date && new Date(t.due_date)<new Date()).length

  return (
    <div className="page">
      {/* Hero consultor */}
      <div style={{
        background:'linear-gradient(135deg, var(--brand-dark) 0%, var(--brand-dark-3) 60%, var(--brand) 100%)',
        borderRadius:'var(--r-xl)', padding:'1.5rem 2rem', color:'#fff',
        marginBottom:'1.5rem', position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', right:-30, top:-30, width:160, height:160, background:'rgba(255,255,255,.04)', borderRadius:'50%' }} />
        <div style={{ fontSize:'.6875rem', fontWeight:600, opacity:.6, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'.375rem' }}>
          BEM-VINDO
        </div>
        <div style={{ fontSize:'1.5rem', fontWeight:800, letterSpacing:'-.025em', marginBottom:'.25rem' }}>
          {profile?.full_name?.split(' ')[0] ?? 'Consultor'} 👋
        </div>
        <div style={{ fontSize:'.9375rem', opacity:.65 }}>
          Aqui está o andamento das suas tarefas hoje.
        </div>
      </div>

      {/* KPIs sem $ */}
      <div className="kpi-grid" style={{ marginBottom:'1.5rem' }}>
        {[
          { icon:'✓',  cls:'brand',  label:'Tarefas abertas',   val: totalAbertas },
          { icon:'⚡', cls:'ok',     label:'Em andamento',      val: emAndamento  },
          { icon:'🔴', cls:'danger', label:'Bloqueadas',        val: bloqueadas,  warn: bloqueadas > 0 },
          { icon:'⏰', cls:'warn',   label:'Em atraso',         val: atrasadas,   warn: atrasadas > 0  },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ borderTop: k.warn ? '3px solid var(--danger)' : undefined }}>
            <div className="kpi-card__top">
              <div>
                <div className="kpi-card__label">{k.label}</div>
                <div className="kpi-card__value">{loading ? '…' : k.val}</div>
              </div>
              <div className={`kpi-card__icon kpi-card__icon--${k.cls}`}>{k.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Projetos em que está alocado — sem valores financeiros */}
      {myProjects.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          {myProjects.map(p => (
            <div key={p.id} className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/projeto/${p.id}`)}>
              <div className="card__body">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.5rem' }}>
                  <span className="badge badge--brand">{p.code}</span>
                  <span className="badge" style={{ background: (PROJ_STATUS_COLOR[p.status] ?? '#94A3B8') + '22', color: PROJ_STATUS_COLOR[p.status] ?? '#94A3B8' }}>
                    {PROJ_STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '.9375rem', marginBottom: '.5rem' }}>{p.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.5rem' }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${p.progress}%`, height: '100%', background: 'var(--brand)', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: '.75rem', color: 'var(--subtle)' }}>{p.progress}%</span>
                </div>
                <div style={{ fontSize: '.75rem', color: 'var(--subtle)', display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
                  {p.sap_module && <span>🧩 {p.sap_module}</span>}
                  {p.end_date && <span>📅 Prazo: {new Date(p.end_date).toLocaleDateString('pt-BR')}</span>}
                  {p.nextMilestone && (
                    <span>🔷 Próximo marco: {p.nextMilestone.name} ({new Date(p.nextMilestone.due_date).toLocaleDateString('pt-BR')})</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Horas lançadas × planejadas (mês atual) */}
      {!hoursLoading && hoursRows.length > 0 && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card__header">
            <span className="card__title">⏱ Horas — lançadas × planejadas (este mês)</span>
            <span style={{ fontSize: '.8125rem', color: 'var(--subtle)' }}>
              {totalLogged.toFixed(1)}h / {totalPlanned.toFixed(1)}h
            </span>
          </div>
          <div className="card__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.875rem' }}>
              {hoursRows.map(r => {
                const pct = r.planned > 0 ? Math.min(Math.round(r.logged / r.planned * 100), 100) : 0
                const over = r.planned > 0 && r.logged > r.planned
                return (
                  <div key={r.projectId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.375rem' }}>
                      <span style={{ fontSize: '.875rem', fontWeight: 600 }}>
                        <span className="badge badge--brand" style={{ marginRight: '.375rem' }}>{r.code}</span>{r.name}
                      </span>
                      <span style={{ fontSize: '.8125rem', fontWeight: 700, color: over ? 'var(--warn)' : 'var(--text)' }}>
                        {r.logged.toFixed(1)}h {r.planned > 0 ? `/ ${r.planned.toFixed(1)}h` : '(sem alocação planejada)'}
                      </span>
                    </div>
                    {r.planned > 0 && (
                      <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: over ? 'var(--warn)' : 'var(--brand)', borderRadius: 99, transition: 'width .5s' }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tarefas por status */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
          {[1,2,3,4,5].map(i=><div key={i} style={{ height:64, borderRadius:'var(--r-lg)' }} className="skeleton" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🎉</div>
          <div className="empty-state__title">Tudo em dia!</div>
          <p className="empty-state__desc">Não há tarefas abertas para você no momento.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          {statuses.map(st => {
            const group = byStatus[st] ?? []
            if (!group.length) return null
            return (
              <div key={st} className="card">
                <div className="card__header">
                  <span className="card__title">
                    <span style={{ width:10, height:10, borderRadius:'50%', background: STATUS_COLOR[st], display:'inline-block', marginRight:'.375rem' }} />
                    {STATUS_LABEL[st]}
                    <span style={{ marginLeft:'.5rem', fontWeight:400, color:'var(--subtle)', fontSize:'.8125rem' }}>({group.length})</span>
                  </span>
                </div>
                <div className="card__body" style={{ padding:0 }}>
                  {group.map((task, i) => (
                    <div key={task.id}
                      style={{ display:'flex', alignItems:'center', gap:'.875rem', padding:'.75rem 1.25rem', borderBottom: i<group.length-1?'1px solid var(--border)':'none', cursor:'pointer' }}
                      onClick={() => navigate(`/projeto/${task.project_id}`)}>
                      {/* Prioridade dot */}
                      <div style={{ width:10, height:10, borderRadius:'50%', background: PRIO_COLOR[task.priority]??'#94A3B8', flexShrink:0 }} title={task.priority} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:'.875rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {task.title}
                        </div>
                        <div style={{ fontSize:'.75rem', color:'var(--subtle)', marginTop:'.125rem', display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                          {task.project && <span>📁 {task.project.code}</span>}
                          {task.sap_activate_phase && <span>🔷 {task.sap_activate_phase}</span>}
                          {task.due_date && (
                            <span style={{ color: new Date(task.due_date)<new Date() ? 'var(--danger)' : 'var(--subtle)' }}>
                              📅 {new Date(task.due_date).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize:'.75rem', color:'var(--subtle-2)', flexShrink:0 }}>→</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
