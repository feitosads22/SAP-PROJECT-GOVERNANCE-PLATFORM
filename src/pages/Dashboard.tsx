import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Project } from '../types/app.types'

type PortfolioRow = {
  project_id: string; project_name: string; project_code: string
  project_status: string; progress: number; health_score: number | null
  health_status: string | null; budget_total: number; cost_actual: number
  tasks_open: number; tasks_done: number; risks_critical: number
  issues_open: number; crs_pending: number; schedule_status: string
  days_remaining: number | null
}

type AuditRow = {
  id: string; action: string; entity_type: string; entity_id: string
  created_at: string; user_id: string
}

type Milestone = {
  id: string; name: string; due_date: string; status: string
  project_id: string; project?: { code: string }
}

const STATUS_COLOR: Record<string,string> = {
  draft:'#94A3B8', active:'#16A34A', on_hold:'#F59E0B',
  completed:'#2563EB', cancelled:'#DC2626',
}
const STATUS_LABEL: Record<string,string> = {
  draft:'Rascunho', active:'Ativo', on_hold:'Em espera',
  completed:'Concluído', cancelled:'Cancelado',
}
const GANTT_COLOR: Record<string,string> = {
  active:'#0A6ED1', draft:'#94A3B8', on_hold:'#F59E0B',
  completed:'#16A34A', cancelled:'#DC2626',
}

function brl(v: number) {
  if (!v) return 'R$ 0'
  if (v >= 1_000_000) return `R$ ${(v/1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v/1_000).toFixed(0)}K`
  return `R$ ${v.toLocaleString('pt-BR')}`
}

function timeAgo(date: string) {
  const d = new Date(date)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 3600)  return `há ${Math.round(diff/60)} min`
  if (diff < 86400) return `há ${Math.round(diff/3600)} h`
  return `há ${Math.round(diff/86400)} d`
}

const MONTH_ABBR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function Dashboard() {
  const { profile, organization } = useAuth()
  const navigate = useNavigate()
  const [portfolio,   setPortfolio]   = useState<PortfolioRow[]>([])
  const [projects,    setProjects]    = useState<Project[]>([])
  const [activities,  setActivities]  = useState<AuditRow[]>([])
  const [milestones,  setMilestones]  = useState<Milestone[]>([])
  const [loading,     setLoading]     = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  async function load() {
    setLoading(true)
    const [rPort, rProj, rAudit, rMile] = await Promise.all([
      sb.from('portfolio_summary').select('*').order('project_code'),
      sb.from('projects').select('*').order('created_at', { ascending: false }),
      sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(6),
      sb.from('milestones').select('*, project:projects(code)')
        .in('status',['not_started','in_progress'])
        .not('due_date','is',null)
        .order('due_date').limit(6),
    ])
    if (!rPort.error)  setPortfolio(rPort.data ?? [])
    if (!rProj.error)  setProjects(rProj.data ?? [])
    if (!rAudit.error) setActivities(rAudit.data ?? [])
    if (!rMile.error)  setMilestones(rMile.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  // KPIs
  const total      = projects.length
  const ativos     = projects.filter(p => p.status === 'active').length
  const atrasados  = portfolio.filter(p => p.schedule_status === 'atrasado').length
  const concluidos = projects.filter(p => p.status === 'completed').length
  const budgetTot  = portfolio.reduce((s, r) => s + (r.budget_total ?? 0), 0)
  const costTot    = portfolio.reduce((s, r) => s + (r.cost_actual ?? 0), 0)

  // Active projects for gantt (max 6)
  const activeProjs = projects.filter(p => p.status === 'active').slice(0, 6)

  // Donut
  const donutData = [
    { label: 'Em andamento', count: ativos,     color: '#0A6ED1' },
    { label: 'Concluídos',   count: concluidos, color: '#16A34A' },
    { label: 'Atrasados',    count: atrasados,  color: '#DC2626' },
    { label: 'Outros',       count: Math.max(0, total - ativos - concluidos - atrasados), color: '#94A3B8' },
  ].filter(d => d.count > 0)

  // Bar chart: by sap_module
  const moduleCount: Record<string,number> = {}
  projects.forEach(p => {
    const m = p.sap_module ?? 'Outros'
    moduleCount[m] = (moduleCount[m] ?? 0) + 1
  })
  const barData = Object.entries(moduleCount).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const barMax  = Math.max(1, ...barData.map(d=>d[1]))

  // Donut SVG
  function DonutChart() {
    const r = 50; const cx = 60; const cy = 60; const stroke = 14
    let offset = -25
    const segments = donutData.map(d => {
      const pct  = total ? d.count / total : 0
      const dash = pct * Math.PI * 2 * r
      const gap  = Math.PI * 2 * r - dash
      const el   = (
        <circle key={d.label} cx={cx} cy={cy} r={r} fill="none"
          stroke={d.color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={-offset}
          style={{ transition: 'stroke-dasharray .6s' }} />
      )
      offset += dash
      return el
    })
    return (
      <div className="donut-wrap">
        <div className="donut">
          <svg viewBox="0 0 120 120" width="120" height="120">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
            {segments}
          </svg>
          <div className="donut-center">
            <span className="donut-center__num">{total}</span>
            <span className="donut-center__lbl">Projetos</span>
          </div>
        </div>
        <div className="donut-legend">
          {donutData.map(d => (
            <div key={d.label} className="donut-legend__item">
              <div className="donut-legend__dot" style={{ background: d.color }} />
              <span className="donut-legend__label">{d.label}</span>
              <span className="donut-legend__pct">
                {total ? Math.round(d.count/total*100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const activityIcon: Record<string,{icon:string;color:string;bg:string}> = {
    update:  { icon:'↑', color:'#1d4ed8', bg:'#dbeafe' },
    create:  { icon:'+', color:'#16a34a', bg:'#dcfce7' },
    approve: { icon:'✓', color:'#16a34a', bg:'#dcfce7' },
    reject:  { icon:'✗', color:'#dc2626', bg:'#fee2e2' },
    complete:{ icon:'✓', color:'#16a34a', bg:'#dcfce7' },
    submit:  { icon:'→', color:'#2563eb', bg:'#dbeafe' },
    delete:  { icon:'✕', color:'#dc2626', bg:'#fee2e2' },
    default: { icon:'·', color:'#64748b', bg:'#f1f5f9' },
  }

  return (
    <div className="page">
      {/* Hero */}
      <div className="dash-hero">
        <div className="dash-hero__left">
          <div className="dash-hero__eyebrow">
            BEM-VINDO, {profile?.full_name?.split(' ')[0]?.toUpperCase() ?? 'USUÁRIO'}
          </div>
          <div className="dash-hero__title">
            {organization?.name ? `Governança de Projetos SAP — ${organization.name}` : 'Governança de Projetos SAP'}
          </div>
          <div className="dash-hero__sub">
            {organization?.name
              ? `Acompanhe os projetos SAP da ${organization.name} com mais previsibilidade.`
              : 'Acompanhe, gerencie e entregue valor com mais previsibilidade.'}
          </div>
        </div>
        <div className="dash-hero__actions">
          <button className="dash-hero__btn dash-hero__btn--primary"
            onClick={() => navigate('/')}>
            + Novo Projeto
          </button>
          <button className="dash-hero__btn dash-hero__btn--outline"
            onClick={() => navigate('/portfolio')}>
            Ver Portfólio
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        {[
          { icon:'📁', cls:'brand',  label:'Total de Projetos',    val: total,    delta: '+3 este mês', dir:'up' },
          { icon:'⚡', cls:'ok',     label:'Em Andamento',          val: ativos,   delta: `${total ? Math.round(ativos/total*100) : 0}% do total`, dir:'neutral' },
          { icon:'⚠️', cls:'warn',   label:'Em Atraso',             val: atrasados,delta: atrasados > 0 ? 'Requer atenção' : 'Nenhum', dir: atrasados > 0 ? 'down' : 'up' },
          { icon:'✅', cls:'purple', label:'Concluídos',             val: concluidos,delta:'+2 este mês', dir:'up' },
          { icon:'💰', cls:'info',   label:'Budget Total',           val: brl(budgetTot),    delta:'', dir:'neutral' },
          { icon:'📈', cls:'danger', label:'Custo Realizado',        val: brl(costTot),      delta: budgetTot ? `${Math.round(costTot/budgetTot*100)}% do budget` : '', dir:'neutral' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-card__top">
              <div>
                <div className="kpi-card__label">{k.label}</div>
                <div className="kpi-card__value">{loading ? '…' : k.val}</div>
              </div>
              <div className={`kpi-card__icon kpi-card__icon--${k.cls}`}>{k.icon}</div>
            </div>
            {k.delta && (
              <div className={`kpi-card__delta kpi-card__delta--${k.dir}`}>
                {k.dir === 'up' ? '↑' : k.dir === 'down' ? '↓' : '·'} {k.delta}
              </div>
            )}
            {k.label === 'Em Andamento' && total > 0 && (
              <div className="kpi-card__bar">
                <div className="kpi-card__bar-fill"
                  style={{ width:`${Math.round(ativos/total*100)}%`, background:'var(--ok)' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="dash-grid">
        <div className="dash-grid__main">
          {/* Gantt */}
          <div className="card">
            <div className="card__header">
              <span className="card__title">
                <span className="card__title-icon">📋</span>
                Projetos em Execução
              </span>
              <button className="card__link" onClick={() => navigate('/')}>Ver todos →</button>
            </div>
            <div className="card__body">
              {loading ? (
                <p className="sutil">Carregando…</p>
              ) : activeProjs.length === 0 ? (
                <p className="sutil">Nenhum projeto ativo.</p>
              ) : (
                activeProjs.map(p => (
                  <div key={p.id} className="gantt-row"
                    style={{ cursor:'pointer' }}
                    onClick={() => navigate(`/projeto/${p.id}`)}>
                    <div>
                      <div className="gantt-row__name">{p.name}</div>
                      <div className="gantt-row__code">{p.code}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                      <div style={{ flex:1 }}>
                        <div className="gantt-bar-wrap">
                          <div className="gantt-bar"
                            style={{ width:`${p.progress}%`, background: GANTT_COLOR[p.status] ?? '#0A6ED1' }} />
                        </div>
                      </div>
                      <span style={{ fontSize:'.6875rem', fontWeight:700, color:'var(--subtle)', minWidth:'2.5rem', textAlign:'right' }}>
                        {p.progress}%
                      </span>
                      <span className="badge" style={{
                        background: (STATUS_COLOR[p.status] ?? '#94A3B8') + '22',
                        color: STATUS_COLOR[p.status] ?? '#94A3B8',
                        borderColor: (STATUS_COLOR[p.status] ?? '#94A3B8') + '44',
                      }}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Donut + Bar */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
            <div className="card">
              <div className="card__header">
                <span className="card__title">
                  <span className="card__title-icon">🥧</span>
                  Status dos Projetos
                </span>
              </div>
              <div className="card__body">
                {loading ? <p className="sutil">Carregando…</p> : <DonutChart />}
              </div>
            </div>

            <div className="card">
              <div className="card__header">
                <span className="card__title">
                  <span className="card__title-icon">📊</span>
                  Por Módulo SAP
                </span>
              </div>
              <div className="card__body">
                {loading ? <p className="sutil">Carregando…</p> : (
                  barData.length === 0 ? <p className="sutil">Sem dados.</p> : (
                    <div className="bar-chart">
                      {barData.map(([label, count]) => (
                        <div key={label} className="bar-chart__col">
                          <div style={{ flex:1, width:'100%', display:'flex', alignItems:'flex-end' }}>
                            <div className="bar-chart__bar"
                              style={{ height:`${Math.round(count/barMax*80)}px` }} />
                          </div>
                          <div className="bar-chart__label">{label}</div>
                          <div style={{ fontSize:'.625rem', fontWeight:700, color:'var(--text)' }}>{count}</div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="card">
            <div className="card__header">
              <span className="card__title">
                <span className="card__title-icon">⚡</span>
                Ações Rápidas
              </span>
            </div>
            <div className="card__body">
              <div className="quick-actions">
                {[
                  { icon:'➕', label:'Novo Projeto',   sub:'Cadastrar projeto SAP',        to:'/' },
                  { icon:'📋', label:'Nova Tarefa',    sub:'Criar tarefa no kanban',        to:'/minhas' },
                  { icon:'⚠️', label:'Novo Risco',     sub:'Registrar risco',              to:'/' },
                  { icon:'📊', label:'Portfólio',      sub:'Visão executiva',              to:'/portfolio' },
                  { icon:'🤖', label:'Assistente IA',  sub:'Perguntas sobre SAP',          to:'/knowledge' },
                  { icon:'⏱', label:'Timesheet',      sub:'Lançar horas',                 to:'/timesheet' },
                ].map(a => (
                  <button key={a.label} className="quick-action" onClick={() => navigate(a.to)}>
                    <div className="quick-action__icon">{a.icon}</div>
                    <div className="quick-action__label">{a.label}</div>
                    <div className="quick-action__sub">{a.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Aside */}
        <div className="dash-grid__aside">
          {/* Milestones */}
          <div className="card">
            <div className="card__header">
              <span className="card__title">
                <span className="card__title-icon">📅</span>
                Próximos Marcos
              </span>
              <button className="card__link">Ver todos →</button>
            </div>
            <div className="card__body">
              {loading ? <p className="sutil">Carregando…</p> :
               milestones.length === 0 ? <p className="sutil">Nenhum marco próximo.</p> :
               milestones.map(m => {
                const d = new Date(m.due_date)
                const today = new Date(); const in14 = new Date(Date.now() + 14*86400000); const sched = d < today ? 'atrasado' : d < in14 ? 'critico' : 'ok'
                return (
                  <div key={m.id} className="milestone-item">
                    <div className="milestone-item__date">
                      <div className="milestone-item__day">{d.getDate()}</div>
                      <div className="milestone-item__month">{MONTH_ABBR[d.getMonth()]}</div>
                    </div>
                    <div className="milestone-item__body">
                      <div className="milestone-item__name">{m.name}</div>
                      <div className="milestone-item__code">
                        {(m.project as {code?:string}|null)?.code ?? '—'}
                      </div>
                    </div>
                    <span className={`badge badge--${sched === 'ok' ? 'ok' : sched === 'critico' ? 'warn' : 'danger'}`}>
                      {sched === 'ok' ? 'No prazo' : sched === 'critico' ? 'Atenção' : 'Atrasado'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Activity */}
          <div className="card">
            <div className="card__header">
              <span className="card__title">
                <span className="card__title-icon">🕐</span>
                Últimas Atividades
              </span>
              <button className="card__link">Ver todas →</button>
            </div>
            <div className="card__body">
              {loading ? <p className="sutil">Carregando…</p> :
               activities.length === 0 ? <p className="sutil">Sem atividades recentes.</p> :
               activities.map(a => {
                const cfg = activityIcon[a.action] ?? activityIcon.default
                return (
                  <div key={a.id} className="activity-item">
                    <div className="activity-item__icon"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.icon}
                    </div>
                    <div className="activity-item__body">
                      <div className="activity-item__title">
                        {a.entity_type} — {a.action}
                      </div>
                      <div className="activity-item__desc">
                        {a.entity_type.replace(/_/g,' ')}
                      </div>
                    </div>
                    <div className="activity-item__time">
                      {timeAgo(a.created_at)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
