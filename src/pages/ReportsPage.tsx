import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Summary = {
  total: number; active: number; completed: number
  atrasados: number; budget: number; cost: number
  risks: number; issues: number; crs: number
}

function brl(v: number) {
  if (!v) return 'R$ 0'
  if (v >= 1_000_000) return `R$ ${(v/1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v/1_000).toFixed(0)}K`
  return `R$ ${v.toLocaleString('pt-BR')}`
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  async function load() {
    setLoading(true)
    const [rPort, rRisks, rIssues, rCRs] = await Promise.all([
      sb.from('portfolio_summary').select('project_status,budget_total,cost_actual,schedule_status'),
      sb.from('project_risks').select('id').not('status','in','(resolved,accepted)').gte('score',9),
      sb.from('project_issues').select('id').in('status',['open','in_progress']),
      sb.from('change_requests').select('id').eq('status','submitted'),
    ])
    const rows = rPort.data ?? []
    setSummary({
      total:     rows.length,
      active:    rows.filter((r: {project_status:string}) => r.project_status === 'active').length,
      completed: rows.filter((r: {project_status:string}) => r.project_status === 'completed').length,
      atrasados: rows.filter((r: {schedule_status:string}) => r.schedule_status === 'atrasado').length,
      budget:    rows.reduce((s: number,r: {budget_total:number}) => s + (r.budget_total??0), 0),
      cost:      rows.reduce((s: number,r: {cost_actual:number})  => s + (r.cost_actual??0),  0),
      risks:     (rRisks.data ?? []).length,
      issues:    (rIssues.data ?? []).length,
      crs:       (rCRs.data ?? []).length,
    })
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const reports = [
    { icon:'📊', title:'Portfólio Executivo',   desc:'Visão geral de todos os projetos com health scores e indicadores.',  link:'/portfolio' },
    { icon:'📁', title:'Status dos Projetos',   desc:'Situação atual de cada projeto com progresso e prioridade.',         link:'/' },
    { icon:'💰', title:'Relatório Financeiro',  desc:'Budget, custo realizado, forecast e variância por projeto.',         link:'/' },
    { icon:'👥', title:'Capacidade e Recursos', desc:'Utilização dos recursos e horas alocadas por período.',              link:'/capacidade' },
    { icon:'⚠️', title:'Gestão de Riscos',      desc:'Risk register com matriz de probabilidade × impacto.',              link:'/' },
    { icon:'📋', title:'Demandas & CRs',        desc:'Change requests e solicitações pendentes de aprovação.',             link:'/demandas' },
    { icon:'⏱', title:'Timesheet',             desc:'Horas lançadas, aprovadas e pendentes por recurso e projeto.',       link:'/timesheet' },
    { icon:'🤖', title:'Histórico de IA',       desc:'Consultas ao assistente IA e artigos mais acessados.',              link:'/knowledge' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">Análise</div>
          <h1>Relatórios</h1>
          <p className="page-header__sub">Indicadores consolidados do portfólio</p>
        </div>
        <div className="page-header__actions">
          <button className="btn-secondary" onClick={() => load()}>🔄 Atualizar</button>
        </div>
      </div>

      {/* KPIs consolidados */}
      {!loading && summary && (
        <div className="kpi-grid" style={{ marginBottom:'1.5rem' }}>
          {[
            { icon:'📁', cls:'brand',  label:'Total de Projetos',    val: summary.total },
            { icon:'⚡', cls:'ok',     label:'Projetos Ativos',      val: summary.active },
            { icon:'✅', cls:'purple', label:'Concluídos',           val: summary.completed },
            { icon:'🔴', cls:'danger', label:'Em Atraso',            val: summary.atrasados },
            { icon:'💰', cls:'info',   label:'Budget Total',         val: brl(summary.budget) },
            { icon:'📈', cls:'warn',   label:'Custo Realizado',      val: brl(summary.cost) },
            { icon:'⚠️', cls:'danger', label:'Riscos Críticos',      val: summary.risks },
            { icon:'🔴', cls:'warn',   label:'Issues Abertas',       val: summary.issues },
          ].map(k => (
            <div key={k.label} className="kpi-card">
              <div className="kpi-card__top">
                <div>
                  <div className="kpi-card__label">{k.label}</div>
                  <div className="kpi-card__value">{k.val}</div>
                </div>
                <div className={`kpi-card__icon kpi-card__icon--${k.cls}`}>{k.icon}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="kpi-grid" style={{ marginBottom:'1.5rem' }}>
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} style={{ height:90, borderRadius:'var(--r-lg)' }} className="skeleton" />)}
        </div>
      )}

      {/* Relatórios disponíveis */}
      <div className="card" style={{ marginBottom:'1.5rem' }}>
        <div className="card__header">
          <span className="card__title"><span className="card__title-icon">📋</span>Relatórios Disponíveis</span>
        </div>
        <div className="card__body" style={{ padding:0 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))' }}>
            {reports.map((r, i) => (
              <a key={r.title} href={r.link}
                style={{
                  display:'flex', gap:'.875rem', padding:'1rem 1.25rem',
                  borderBottom: i < reports.length-2 ? '1px solid var(--border)' : 'none',
                  borderRight: (i%2===0) ? '1px solid var(--border)' : 'none',
                  textDecoration:'none', transition:'background .15s', color:'inherit',
                }}
                onMouseEnter={e => (e.currentTarget.style.background='var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background='')}
              >
                <div style={{ fontSize:'1.5rem', flexShrink:0, marginTop:'.125rem' }}>{r.icon}</div>
                <div>
                  <div style={{ fontWeight:700, fontSize:'.9375rem', color:'var(--text)', marginBottom:'.25rem' }}>{r.title}</div>
                  <div style={{ fontSize:'.8125rem', color:'var(--subtle)', lineHeight:1.5 }}>{r.desc}</div>
                </div>
                <div style={{ marginLeft:'auto', color:'var(--brand)', fontSize:'.875rem', alignSelf:'center', flexShrink:0 }}>→</div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Budget vs Custo */}
      {!loading && summary && summary.budget > 0 && (
        <div className="card">
          <div className="card__header">
            <span className="card__title"><span className="card__title-icon">💰</span>Budget vs Custo Realizado (Portfólio)</span>
          </div>
          <div className="card__body">
            <div style={{ display:'flex', flexDirection:'column', gap:'.875rem' }}>
              {[
                { label:'Budget total',     val:summary.budget, pct:100,   color:'var(--brand)' },
                { label:'Custo realizado',  val:summary.cost,   pct:summary.budget?Math.min(summary.cost/summary.budget*100,100):0, color: summary.cost > summary.budget ? 'var(--danger)' : 'var(--ok)' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.375rem' }}>
                    <span style={{ fontSize:'.875rem', fontWeight:600, color:'var(--text)' }}>{item.label}</span>
                    <span style={{ fontSize:'.875rem', fontWeight:700, color: item.color }}>{brl(item.val)}</span>
                  </div>
                  <div style={{ height:10, background:'var(--surface-3)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ width:`${item.pct}%`, height:'100%', background: item.color, borderRadius:99, transition:'width .5s' }} />
                  </div>
                </div>
              ))}
              <p style={{ fontSize:'.8125rem', color:'var(--subtle)', marginTop:'.25rem' }}>
                Utilização do budget: <strong>{summary.budget ? Math.round(summary.cost/summary.budget*100) : 0}%</strong>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
