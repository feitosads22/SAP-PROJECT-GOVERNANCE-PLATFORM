import { useEffect, useState } from 'react'
import CreateProjectModal from '../components/CreateProjectModal'
import { useNavigate } from 'react-router-dom'
import { getProjects } from '../lib/api'
import type { Project } from '../types/app.types'

const STATUS_COLOR: Record<string,string> = {
  draft:'#94A3B8', active:'#16A34A', on_hold:'#F59E0B',
  completed:'#2563EB', cancelled:'#DC2626',
}
const STATUS_LABEL: Record<string,string> = {
  draft:'Rascunho', active:'Ativo', on_hold:'Em espera',
  completed:'Concluído', cancelled:'Cancelado',
}
const PRIORITY_COLOR: Record<string,string> = {
  low:'#94A3B8', medium:'#F59E0B', high:'#EF4444', critical:'#7C3AED',
}
const PRIORITY_LABEL: Record<string,string> = {
  low:'Baixa', medium:'Média', high:'Alta', critical:'Crítica',
}

type ViewMode = 'cards' | 'table'

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState<string | null>(null)
  const [view,     setView]     = useState<ViewMode>('cards')
  const [search,   setSearch]   = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterModule,   setFilterModule]   = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    getProjects().then(({ data, error }) => {
      if (error) setErro(error.message)
      else setProjects(data ?? [])
      setLoading(false)
    })
  }, [])

  const filtered = projects.filter(p => {
    if (filterStatus   && p.status   !== filterStatus)   return false
    if (filterPriority && p.priority !== filterPriority) return false
    if (filterModule   && p.sap_module !== filterModule) return false
    if (search) {
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const modules = [...new Set(projects.map(p => p.sap_module).filter(Boolean))] as string[]

  function ProgressBar({ value }: { value: number }) {
    const color = value >= 75 ? '#16A34A' : value >= 40 ? '#0A6ED1' : '#F59E0B'
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
        <div style={{ flex:1, height:5, background:'var(--surface-3)', borderRadius:99, overflow:'hidden' }}>
          <div style={{ width:`${value}%`, height:'100%', background: color, borderRadius:99 }} />
        </div>
        <span style={{ fontSize:'.6875rem', fontWeight:700, color:'var(--subtle)', minWidth:'2rem' }}>{value}%</span>
      </div>
    )
  }

  return (
    <>
      <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">Governança</div>
          <h1>Projetos</h1>
          <p className="page-header__sub">{filtered.length} projeto{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="page-header__actions">
          <div style={{ display:'flex', gap:'.25rem', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'.2rem' }}>
            {(['cards','table'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{
                  background: view===v ? 'var(--surface)' : 'none',
                  border: 'none', borderRadius:'var(--r-sm)', padding:'.3rem .625rem',
                  fontSize:'.75rem', fontWeight: view===v ? 600 : 400,
                  color: view===v ? 'var(--text)' : 'var(--subtle)',
                  boxShadow: view===v ? 'var(--shadow-xs)' : 'none',
                }}>
                {v === 'cards' ? '⊞ Cards' : '☰ Tabela'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreate(true)}>+ Novo Projeto</button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou código…"
          style={{ flex:1, minWidth:180, maxWidth:320 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">Toda prioridade</option>
          {Object.entries(PRIORITY_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {modules.length > 0 && (
          <select value={filterModule} onChange={e => setFilterModule(e.target.value)}>
            <option value="">Todo módulo</option>
            {modules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        {(search||filterStatus||filterPriority||filterModule) && (
          <button className="btn-ghost" style={{ fontSize:'.75rem' }}
            onClick={() => { setSearch(''); setFilterStatus(''); setFilterPriority(''); setFilterModule('') }}>
            Limpar filtros
          </button>
        )}
      </div>

      {erro && <p className="erro">{erro}</p>}

      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1rem' }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ height:180, borderRadius:'var(--r-lg)' }} className="skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📁</div>
          <div className="empty-state__title">Nenhum projeto encontrado</div>
          <p className="empty-state__desc">Tente ajustar os filtros ou criar um novo projeto.</p>
        </div>
      ) : view === 'cards' ? (
        <div className="project-grid">
          {filtered.map(p => (
            <div key={p.id} className="pcard" onClick={() => navigate(`/projeto/${p.id}`)}>
              <div className="pcard__top">
                <span className="pcard__code">{p.code}</span>
                <span className="badge" style={{
                  background: (STATUS_COLOR[p.status]??'#94A3B8')+'22',
                  color: STATUS_COLOR[p.status]??'#94A3B8',
                  borderColor: (STATUS_COLOR[p.status]??'#94A3B8')+'44',
                }}>
                  {STATUS_LABEL[p.status]??p.status}
                </span>
              </div>
              <h3 className="pcard__name">{p.name}</h3>
              {p.description && <p className="pcard__desc">{p.description}</p>}
              <ProgressBar value={p.progress} />
              <div className="pcard__footer">
                {p.sap_module && <span className="badge badge--brand">{p.sap_module}</span>}
                {p.priority && (
                  <span className="badge" style={{
                    background: (PRIORITY_COLOR[p.priority]??'#94A3B8')+'22',
                    color: PRIORITY_COLOR[p.priority]??'#94A3B8',
                    borderColor: (PRIORITY_COLOR[p.priority]??'#94A3B8')+'44',
                  }}>
                    {PRIORITY_LABEL[p.priority]??p.priority}
                  </span>
                )}
                {p.end_date && (
                  <span className="badge" style={{ marginLeft:'auto' }}>
                    {new Date(p.end_date).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th><th>Projeto</th><th>Módulo</th>
                <th>Status</th><th>Progresso</th><th>Prioridade</th><th>Prazo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ cursor:'pointer' }} onClick={() => navigate(`/projeto/${p.id}`)}>
                  <td>
                    <span style={{ fontWeight:700, color:'var(--brand)', fontSize:'.8125rem' }}>{p.code}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight:600, color:'var(--text)' }}>{p.name}</div>
                    {p.description && <div style={{ fontSize:'.75rem', color:'var(--subtle)', marginTop:'.1rem', maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.description}</div>}
                  </td>
                  <td>{p.sap_module ? <span className="badge badge--brand">{p.sap_module}</span> : '—'}</td>
                  <td>
                    <span className="badge" style={{
                      background: (STATUS_COLOR[p.status]??'#94A3B8')+'22',
                      color: STATUS_COLOR[p.status]??'#94A3B8',
                      borderColor: (STATUS_COLOR[p.status]??'#94A3B8')+'44',
                    }}>
                      {STATUS_LABEL[p.status]??p.status}
                    </span>
                  </td>
                  <td style={{ minWidth:140 }}><ProgressBar value={p.progress} /></td>
                  <td>
                    {p.priority ? (
                      <span className="badge" style={{
                        background: (PRIORITY_COLOR[p.priority]??'#94A3B8')+'22',
                        color: PRIORITY_COLOR[p.priority]??'#94A3B8',
                        borderColor: (PRIORITY_COLOR[p.priority]??'#94A3B8')+'44',
                      }}>
                        {PRIORITY_LABEL[p.priority]??p.priority}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize:'.8125rem', color: p.end_date && new Date(p.end_date)<new Date() ? 'var(--danger)' : 'var(--text-2)' }}>
                    {p.end_date ? new Date(p.end_date).toLocaleDateString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
      {showCreate && (
      <CreateProjectModal
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); getProjects().then(({data}) => setProjects(data??[])) }}
      />
      )}
    </>
  )
}