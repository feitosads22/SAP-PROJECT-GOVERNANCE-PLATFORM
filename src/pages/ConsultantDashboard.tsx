import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type MyTask = {
  id:string; title:string; status:string; priority:string
  sap_activate_phase:string|null; due_date:string|null; project_id:string
  project:{ name:string; code:string }|null
}

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

  useEffect(() => { void load() }, [])

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
