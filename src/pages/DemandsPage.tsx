import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getProjects } from '../lib/api'
import type { Project } from '../types/app.types'

// Demandas são armazenadas como change_requests com categoria de demanda
// ou podemos usar knowledge_articles como placeholder.
// Por ora, usamos change_requests como "demandas" (já temos a tabela).
type Demand = {
  id: string; number: number; title: string; description: string | null
  justification: string | null; additional_cost: number; schedule_impact_days: number
  status: string; requested_by: string | null; created_at: string
  project_id: string | null
}

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  draft:      { label:'Nova',         color:'#64748B', bg:'#F1F5F9' },
  submitted:  { label:'Em análise',   color:'#2563EB', bg:'#DBEAFE' },
  approved:   { label:'Aprovada',     color:'#16A34A', bg:'#DCFCE7' },
  rejected:   { label:'Rejeitada',    color:'#DC2626', bg:'#FEE2E2' },
  cancelled:  { label:'Cancelada',    color:'#94A3B8', bg:'#F1F5F9' },
}

function brl(v: number) {
  if (!v) return 'R$ 0'
  if (v >= 1_000_000) return `R$ ${(v/1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v/1_000).toFixed(0)}K`
  return `R$ ${v.toLocaleString('pt-BR')}`
}

export default function DemandsPage() {
  const [demands,  setDemands]  = useState<Demand[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('')
  const [search,   setSearch]   = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  async function load() {
    setLoading(true)
    const [rD, rP] = await Promise.all([
      sb.from('change_requests').select('*').order('created_at', { ascending: false }),
      getProjects(),
    ])
    if (!rD.error) setDemands(rD.data ?? [])
    if (!rP.error) setProjects(rP.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const filtered = demands.filter(d => {
    if (filter && d.status !== filter) return false
    if (search) return d.title.toLowerCase().includes(search.toLowerCase())
    return true
  })

  const projMap = Object.fromEntries(projects.map(p => [p.id, p]))

  // Kanban-style status columns
  const statuses = ['draft','submitted','approved','rejected','cancelled']

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">Governança</div>
          <h1>Demandas & Change Requests</h1>
          <p className="page-header__sub">Gerencie solicitações e mudanças do projeto</p>
        </div>
        <div className="page-header__actions">
          <button onClick={() => load()}>🔄 Atualizar</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', marginBottom:'1.5rem' }}>
        {statuses.map(s => {
          const cfg = STATUS_CFG[s]
          const cnt = demands.filter(d => d.status === s).length
          return (
            <div key={s} className="kpi-card" style={{ cursor:'pointer', borderTop:`3px solid ${cfg.color}` }}
              onClick={() => setFilter(filter === s ? '' : s)}>
              <div className="kpi-card__label">{cfg.label}</div>
              <div className="kpi-card__value" style={{ fontSize:'1.5rem', color: cfg.color }}>{cnt}</div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar demanda…"
          style={{ flex:1, minWidth:200 }} />
        <select value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="">Todos os status</option>
          {statuses.map(s=><option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
        </select>
        {(search||filter) && (
          <button className="btn-ghost" style={{fontSize:'.75rem'}} onClick={()=>{setSearch('');setFilter('')}}>
            Limpar
          </button>
        )}
      </div>

      {loading ? (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:'1rem'}}>
          {[1,2,3,4].map(i=><div key={i} style={{height:120,borderRadius:'var(--r-lg)'}} className="skeleton"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📋</div>
          <div className="empty-state__title">Nenhuma demanda encontrada</div>
          <p className="empty-state__desc">Crie change requests nos projetos para gerenciá-los aqui.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Título</th><th>Projeto</th>
                <th>Custo</th><th>Prazo (+dias)</th><th>Status</th><th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const cfg = STATUS_CFG[d.status] ?? STATUS_CFG.draft
                const proj = d.project_id ? projMap[d.project_id] : null
                return (
                  <tr key={d.id}>
                    <td><span style={{fontWeight:700,color:'var(--brand)',fontSize:'.8125rem'}}>CR-{String(d.number).padStart(3,'0')}</span></td>
                    <td>
                      <div style={{fontWeight:600,color:'var(--text)'}}>{d.title}</div>
                      {d.description && <div style={{fontSize:'.75rem',color:'var(--subtle)',marginTop:'.1rem',maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.description}</div>}
                    </td>
                    <td>{proj ? <span className="badge badge--brand">{proj.code}</span> : '—'}</td>
                    <td style={{fontWeight:600}}>{d.additional_cost > 0 ? brl(d.additional_cost) : '—'}</td>
                    <td>{d.schedule_impact_days > 0 ? <span className="badge badge--warn">+{d.schedule_impact_days}d</span> : '—'}</td>
                    <td>
                      <span className="badge" style={{background:cfg.bg,color:cfg.color,borderColor:cfg.color+'33'}}>
                        {cfg.label}
                      </span>
                    </td>
                    <td style={{fontSize:'.8125rem',color:'var(--subtle)'}}>
                      {new Date(d.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
