import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type PortfolioRow = {
  project_id: string
  project_name: string
  project_code: string
  project_status: string
  project_priority: string
  progress: number
  start_date: string | null
  end_date: string | null
  sap_module: string | null
  health_score: number | null
  health_status: string | null
  budget_total: number
  cost_actual: number
  cost_forecast: number
  variance_pct: number
  margin_pct: number
  financial_status: string | null
  tasks_open: number
  tasks_done: number
  risks_critical: number
  issues_open: number
  crs_pending: number
  schedule_status: string
  days_remaining: number | null
}

const HEALTH_CFG: Record<string, { icon: string; label: string; color: string }> = {
  healthy:   { icon: '🟢', label: 'Saudável',    color: '#16a34a' },
  attention: { icon: '🟡', label: 'Atenção',     color: '#d97706' },
  at_risk:   { icon: '🟠', label: 'Em risco',    color: '#ea580c' },
  critical:  { icon: '🔴', label: 'Crítico',     color: '#dc2626' },
}

const FIN_CFG: Record<string, { icon: string; color: string }> = {
  ok:           { icon: '🟢', color: '#16a34a' },
  atencao:      { icon: '🟡', color: '#d97706' },
  estourado:    { icon: '🔴', color: '#dc2626' },
  sem_orcamento:{ icon: '⚪', color: '#94a3b8' },
}

const STATUS_COLOR: Record<string, string> = {
  draft:'#94a3b8', active:'#16a34a', on_hold:'#d97706',
  completed:'#1d4ed8', cancelled:'#dc2626',
}
const STATUS_LABEL: Record<string, string> = {
  draft:'Rascunho', active:'Ativo', on_hold:'Em espera',
  completed:'Concluído', cancelled:'Cancelado',
}

function brl(v: number) {
  if (!v) return '—'
  if (v >= 1_000_000) return `R$ ${(v/1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v/1_000).toFixed(0)}K`
  return v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="sutil">—</span>
  const cfg = score >= 85 ? HEALTH_CFG.healthy
            : score >= 70 ? HEALTH_CFG.attention
            : score >= 50 ? HEALTH_CFG.at_risk
            : HEALTH_CFG.critical
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
      <div style={{ flex:1, height:6, background:'var(--bg)', borderRadius:99, overflow:'hidden', minWidth:60 }}>
        <div style={{ height:'100%', width:`${score}%`, background: cfg.color, borderRadius:99 }} />
      </div>
      <span style={{ fontSize:'0.75rem', fontWeight:700, color: cfg.color, minWidth:'2rem' }}>
        {score}
      </span>
    </div>
  )
}

export default function PortfolioPage({ role }: { role: string }) {
  const [rows,       setRows]       = useState<PortfolioRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [erro,       setErro]       = useState<string | null>(null)
  const [calculating,setCalculating]= useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterHealth, setFilterHealth] = useState('')

  const canAdmin = role === 'admin' || role === 'manager'

  async function load() {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('portfolio_summary').select('*').order('project_code')
    if (error) setErro(typeof error === 'object' ? (error as Record<string,unknown>)['message'] as string : String(error))
    else setRows(data ?? [])
    setLoading(false)
  }

  async function refreshAllScores() {
    setCalculating(true)
    for (const row of rows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('calculate_health_score', { p_project_id: row.project_id })
    }
    setCalculating(false)
    void load()
  }

  useEffect(() => { void load() }, [])

  const filtered = rows.filter(r => {
    if (filterStatus && r.project_status !== filterStatus) return false
    if (filterHealth && r.health_status !== filterHealth) return false
    return true
  })

  // KPIs do portfolio
  const total     = filtered.length
  const ativos    = filtered.filter(r => r.project_status === 'active').length
  const criticos  = filtered.filter(r => r.health_status === 'critical').length
  const atrasados = filtered.filter(r => r.schedule_status === 'atrasado').length
  const budgetTotal = filtered.reduce((s, r) => s + r.budget_total, 0)
  const costTotal   = filtered.reduce((s, r) => s + r.cost_actual, 0)

  return (
    <div className="pagina pagina--wide">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Portfolio</h1>
          <p className="sutil">Visão executiva de todos os projetos</p>
        </div>
        <div className="page-header__actions">
          {canAdmin && (
            <button className="btn-outline" onClick={refreshAllScores} disabled={calculating}>
              {calculating ? 'Calculando…' : '🔄 Atualizar health scores'}
            </button>
          )}
        </div>
      </div>

      {/* KPIs executivos */}
      <div className="fin-kpis" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', marginBottom:'1.5rem' }}>
        {[
          { label:'Total de projetos', val: String(total) },
          { label:'Projetos ativos',   val: String(ativos) },
          { label:'Críticos',          val: String(criticos), cls: criticos > 0 ? 'kpi--danger' : '' },
          { label:'Atrasados',         val: String(atrasados), cls: atrasados > 0 ? 'kpi--danger' : '' },
          { label:'Budget total',      val: brl(budgetTotal) },
          { label:'Custo realizado',   val: brl(costTotal) },
        ].map(k => (
          <div key={k.label} className={`kpi-card ${k.cls ?? ''}`}>
            <span className="kpi-card__label">{k.label}</span>
            <span className="kpi-card__val">{k.val}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' }}>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
          style={{ width:'auto', fontSize:'0.8125rem', padding:'0.35rem 0.6rem' }}>
          <option value="">Todos os status</option>
          {['active','draft','on_hold','completed','cancelled'].map(s=>(
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select value={filterHealth} onChange={e=>setFilterHealth(e.target.value)}
          style={{ width:'auto', fontSize:'0.8125rem', padding:'0.35rem 0.6rem' }}>
          <option value="">Todos os health</option>
          {Object.entries(HEALTH_CFG).map(([k,v])=>(
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        {(filterStatus||filterHealth) && (
          <button className="btn-ghost" style={{ fontSize:'0.8125rem' }}
            onClick={()=>{ setFilterStatus(''); setFilterHealth('') }}>
            Limpar filtros
          </button>
        )}
      </div>

      {erro    && <p className="erro">{erro}</p>}
      {loading && <p className="sutil">Carregando…</p>}

      {/* Tabela */}
      <div style={{ overflowX:'auto' }}>
        <table className="tabela">
          <thead>
            <tr>
              <th>Projeto</th>
              <th>Status</th>
              <th>Health</th>
              <th>Score</th>
              <th>Progresso</th>
              <th>Budget</th>
              <th>Custo</th>
              <th>Fin.</th>
              <th>Tarefas</th>
              <th>Riscos</th>
              <th>Issues</th>
              <th>CRs</th>
              <th>Prazo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const hcfg = HEALTH_CFG[r.health_status ?? '']
              const fcfg = FIN_CFG[r.financial_status ?? '']
              const sched = r.schedule_status
              return (
                <tr key={r.project_id}>
                  <td>
                    <Link to={`/projeto/${r.project_id}`}
                      style={{ fontWeight:600, color:'var(--accent)' }}>
                      {r.project_code}
                    </Link>
                    <p className="sutil" style={{ marginTop:'0.1rem' }}>{r.project_name}</p>
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: STATUS_COLOR[r.project_status]+'22',
                      color: STATUS_COLOR[r.project_status],
                      borderColor: STATUS_COLOR[r.project_status]+'44',
                    }}>
                      {STATUS_LABEL[r.project_status] ?? r.project_status}
                    </span>
                  </td>
                  <td style={{ whiteSpace:'nowrap' }}>
                    {hcfg ? `${hcfg.icon} ${hcfg.label}` : '—'}
                  </td>
                  <td style={{ minWidth:100 }}>
                    <ScoreBar score={r.health_score} />
                  </td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.375rem' }}>
                      <div style={{ width:40, height:5, background:'var(--bg)', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ width:`${r.progress}%`, height:'100%', background:'var(--accent)', borderRadius:99 }} />
                      </div>
                      <span style={{ fontSize:'0.75rem', color:'var(--subtle)' }}>{r.progress}%</span>
                    </div>
                  </td>
                  <td className="sutil">{brl(r.budget_total)}</td>
                  <td className="sutil">{brl(r.cost_actual)}</td>
                  <td>{fcfg ? fcfg.icon : '—'}</td>
                  <td>
                    <span style={{ fontSize:'0.8125rem' }}>
                      {r.tasks_done}/{r.tasks_open + r.tasks_done}
                    </span>
                  </td>
                  <td>
                    {r.risks_critical > 0
                      ? <span className="badge badge--rejected">{r.risks_critical} 🔴</span>
                      : <span className="sutil">0</span>}
                  </td>
                  <td>
                    {r.issues_open > 0
                      ? <span className="badge badge--submitted">{r.issues_open}</span>
                      : <span className="sutil">0</span>}
                  </td>
                  <td>
                    {r.crs_pending > 0
                      ? <span className="badge badge--submitted">{r.crs_pending}</span>
                      : <span className="sutil">0</span>}
                  </td>
                  <td style={{ whiteSpace:'nowrap' }}>
                    {sched === 'atrasado' && <span className="badge badge--rejected">Atrasado</span>}
                    {sched === 'critico'  && <span className="badge badge--submitted">
                      {r.days_remaining}d
                    </span>}
                    {sched === 'ok' && r.days_remaining != null && (
                      <span className="sutil">{r.days_remaining}d</span>
                    )}
                    {sched === 'sem_prazo' && <span className="sutil">—</span>}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={13} className="sutil" style={{textAlign:'center',padding:'2rem'}}>
                Nenhum projeto encontrado.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
