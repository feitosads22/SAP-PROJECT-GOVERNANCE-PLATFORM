import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type PortalRow = {
  project_id: string
  project_name: string
  project_code: string
  status: string
  progress: number
  start_date: string | null
  end_date: string | null
  description: string | null
  sap_module: string | null
  health_score: number | null
  health_status: string | null
  tasks_done: number
  tasks_total: number
  milestones_done: number
  milestones_total: number
  next_milestone_name: string | null
  next_milestone_date: string | null
  updates_count: number
  schedule_status: string
  days_remaining: number | null
}

type CustomerUpdate = {
  id: string
  title: string
  body: string
  update_type: string
  published_at: string | null
}

const HEALTH_CFG: Record<string, { icon: string; label: string; color: string }> = {
  healthy:   { icon: '🟢', label: 'Saudável',  color: '#16a34a' },
  attention: { icon: '🟡', label: 'Atenção',   color: '#d97706' },
  at_risk:   { icon: '🟠', label: 'Em risco',  color: '#ea580c' },
  critical:  { icon: '🔴', label: 'Crítico',   color: '#dc2626' },
}

const UPDATE_TYPE_LABEL: Record<string, string> = {
  general:'Geral', milestone:'Marco', risk:'Risco',
  financial:'Financeiro', schedule:'Prazo',
}
const UPDATE_TYPE_COLOR: Record<string, string> = {
  general:'#6b7280', milestone:'#1d4ed8', risk:'#dc2626',
  financial:'#16a34a', schedule:'#d97706',
}

const STATUS_COLOR: Record<string, string> = {
  draft:'#94a3b8', active:'#16a34a', on_hold:'#d97706',
  completed:'#1d4ed8', cancelled:'#dc2626',
}
const STATUS_LABEL: Record<string, string> = {
  draft:'Rascunho', active:'Ativo', on_hold:'Em espera',
  completed:'Concluído', cancelled:'Cancelado',
}

export default function CustomerPortalPage() {
  const [projects, setProjects] = useState<PortalRow[]>([])
  const [selected, setSelected] = useState<PortalRow | null>(null)
  const [updates,  setUpdates]  = useState<CustomerUpdate[]>([])
  const [loading,  setLoading]  = useState(true)

  async function load() {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('customer_portal').select('*').order('project_code')
    setProjects(data ?? [])
    setLoading(false)
    if (data?.length === 1) void selectProject(data[0])
  }

  async function selectProject(row: PortalRow) {
    setSelected(row)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('customer_updates').select('*')
      .eq('project_id', row.project_id)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
    setUpdates(data ?? [])
  }

  useEffect(() => { void load() }, [])

  if (loading) return <div className="page"><p className="sutil">Carregando portal…</p></div>

  if (projects.length === 0) return (
    <div className="page">
      <div className="page-header"><div className="page-header__left"><h1>Portal do Cliente</h1></div></div>
      <div style={{ textAlign:'center', padding:'4rem 1rem' }}>
        <p style={{ fontSize:'3rem' }}>📋</p>
        <p style={{ fontWeight:600, fontSize:'1.125rem', marginTop:'1rem' }}>Nenhum projeto vinculado</p>
        <p className="sutil" style={{ marginTop:'0.5rem' }}>
          Aguarde o gerente do projeto vincular você a um projeto.
        </p>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Portal do Cliente</h1>
          <p className="sutil">{projects.length} projeto{projects.length !== 1 ? 's' : ''} vinculado{projects.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Seletor de projeto se tiver mais de um */}
      {projects.length > 1 && (
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
          {projects.map(p => (
            <button key={p.project_id}
              className={selected?.project_id === p.project_id ? '' : 'btn-outline'}
              onClick={() => void selectProject(p)}>
              {p.project_code}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>

          {/* Header do projeto */}
          <div style={{
            background:'var(--surface)', border:'1px solid var(--border)',
            borderRadius:'var(--radius-lg)', padding:'1.5rem',
            boxShadow:'var(--shadow-sm)',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'1rem' }}>
              <div>
                <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.5rem' }}>
                  <span className="badge" style={{
                    background: STATUS_COLOR[selected.status]+'22',
                    color: STATUS_COLOR[selected.status],
                    borderColor: STATUS_COLOR[selected.status]+'44',
                  }}>{STATUS_LABEL[selected.status]}</span>
                  {selected.sap_module && <span className="badge">{selected.sap_module}</span>}
                </div>
                <h2 style={{ fontSize:'1.375rem', fontWeight:800, letterSpacing:'-.02em' }}>
                  {selected.project_name}
                </h2>
                {selected.description && (
                  <p className="sutil" style={{ marginTop:'0.375rem', maxWidth:560 }}>{selected.description}</p>
                )}
              </div>

              {/* Health score */}
              {selected.health_status && HEALTH_CFG[selected.health_status] && (
                <div style={{ textAlign:'center', minWidth:120 }}>
                  <div style={{
                    fontSize:'2.5rem', fontWeight:800,
                    color: HEALTH_CFG[selected.health_status].color,
                  }}>
                    {selected.health_score}
                  </div>
                  <div style={{ fontSize:'0.75rem', color: HEALTH_CFG[selected.health_status].color, fontWeight:700 }}>
                    {HEALTH_CFG[selected.health_status].icon} {HEALTH_CFG[selected.health_status].label}
                  </div>
                </div>
              )}
            </div>

            {/* Barra de progresso */}
            <div style={{ marginTop:'1.25rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.375rem' }}>
                <span className="sutil" style={{ fontSize:'0.75rem', fontWeight:600 }}>PROGRESSO GERAL</span>
                <span style={{ fontWeight:700, fontSize:'0.875rem' }}>{selected.progress}%</span>
              </div>
              <div style={{ height:10, background:'var(--bg)', borderRadius:99, overflow:'hidden' }}>
                <div style={{
                  width:`${selected.progress}%`, height:'100%',
                  background:'var(--accent)', borderRadius:99, transition:'width .4s',
                }} />
              </div>
            </div>

            {/* Datas e prazo */}
            <div style={{ display:'flex', gap:'2rem', marginTop:'1rem', flexWrap:'wrap' }}>
              {selected.start_date && (
                <div>
                  <p className="sutil" style={{ fontSize:'0.6875rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>Início</p>
                  <p style={{ fontWeight:600 }}>{new Date(selected.start_date).toLocaleDateString('pt-BR')}</p>
                </div>
              )}
              {selected.end_date && (
                <div>
                  <p className="sutil" style={{ fontSize:'0.6875rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>Término previsto</p>
                  <p style={{ fontWeight:600, color: selected.schedule_status === 'atrasado' ? 'var(--danger)' : 'var(--text)' }}>
                    {new Date(selected.end_date).toLocaleDateString('pt-BR')}
                    {selected.schedule_status === 'atrasado' && ' ⚠️ Atrasado'}
                    {selected.schedule_status === 'ok' && selected.days_remaining != null && (
                      <span className="sutil"> ({selected.days_remaining}d restantes)</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'0.75rem' }}>
            {[
              { label:'Tarefas concluídas', val:`${selected.tasks_done} / ${selected.tasks_total}`, pct: selected.tasks_total > 0 ? selected.tasks_done/selected.tasks_total : 0 },
              { label:'Marcos concluídos', val:`${selected.milestones_done} / ${selected.milestones_total}`, pct: selected.milestones_total > 0 ? selected.milestones_done/selected.milestones_total : 0 },
            ].map(k => (
              <div key={k.label} className="kpi-card">
                <span className="kpi-card__label">{k.label}</span>
                <span className="kpi-card__val">{k.val}</span>
                <div style={{ height:4, background:'var(--bg)', borderRadius:99, overflow:'hidden', marginTop:'0.25rem' }}>
                  <div style={{ width:`${k.pct*100}%`, height:'100%', background:'var(--accent)', borderRadius:99 }} />
                </div>
              </div>
            ))}

            {selected.next_milestone_name && (
              <div className="kpi-card" style={{ gridColumn:'span 2' }}>
                <span className="kpi-card__label">Próximo marco</span>
                <span style={{ fontWeight:600, fontSize:'0.9375rem' }}>{selected.next_milestone_name}</span>
                {selected.next_milestone_date && (
                  <span className="sutil" style={{ fontSize:'0.8125rem' }}>
                    {new Date(selected.next_milestone_date).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Updates */}
          <section>
            <h2 className="section-title">Atualizações do projeto</h2>
            {updates.length === 0 ? (
              <p className="sutil">Nenhuma atualização publicada ainda.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                {updates.map(u => (
                  <div key={u.id} style={{
                    background:'var(--surface)', border:'1px solid var(--border)',
                    borderRadius:'var(--radius)', padding:'1.125rem 1.25rem',
                    borderLeft:`4px solid ${UPDATE_TYPE_COLOR[u.update_type] ?? '#6b7280'}`,
                    boxShadow:'var(--shadow-sm)',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'1rem', flexWrap:'wrap' }}>
                      <div>
                        <span className="badge" style={{
                          background: UPDATE_TYPE_COLOR[u.update_type]+'22',
                          color: UPDATE_TYPE_COLOR[u.update_type],
                          borderColor: UPDATE_TYPE_COLOR[u.update_type]+'44',
                          marginBottom:'0.375rem',
                        }}>
                          {UPDATE_TYPE_LABEL[u.update_type] ?? u.update_type}
                        </span>
                        <h3 style={{ fontWeight:700, fontSize:'0.9375rem', marginTop:'0.25rem' }}>{u.title}</h3>
                      </div>
                      {u.published_at && (
                        <span className="sutil" style={{ whiteSpace:'nowrap', fontSize:'0.75rem' }}>
                          {new Date(u.published_at).toLocaleDateString('pt-BR', {
                            day:'2-digit', month:'short', year:'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    <p style={{ marginTop:'0.625rem', fontSize:'0.875rem', color:'var(--text-2)', lineHeight:1.6 }}>
                      {u.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
