import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getProjects } from '../lib/api'
import { generateWeeklyStatusReport } from '../lib/statusReport'
import { useAuth } from '../contexts/AuthContext'
import { toast } from '../components/Toast'
import type { Project } from '../types/app.types'

type Manual = {
  id: string; title: string; description: string | null
  storage_path: string; file_name: string; file_size: number | null
  mime_type: string | null; version: string | null; created_at: string; project_id: string
}
type Article = {
  id: string; title: string; summary: string | null; category: string
  sap_activate_phase: string | null; created_at: string
}

const CAT_LABEL: Record<string,string> = {
  general:'Geral', technical:'Técnico', process:'Processo',
  template:'Template', lesson_learned:'Lição Aprendida', faq:'FAQ',
}
const CAT_COLOR: Record<string,string> = {
  general:'#64748B', technical:'#1D4ED8', process:'#16A34A',
  template:'#D97706', lesson_learned:'#7C3AED', faq:'#0891B2',
}

function fileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes >= 1024*1024) return `${(bytes/1024/1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes/1024)} KB`
  return `${bytes} B`
}

export default function DocumentsPage() {
  const { organization } = useAuth()
  const [tab,      setTab]      = useState<'manuals'|'kb'>('manuals')
  const [gerandoReport, setGerandoReport] = useState(false)
  const [manuals,  setManuals]  = useState<Manual[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filterCat,setFilterCat]= useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  async function load() {
    setLoading(true)
    const [rM, rA, rP] = await Promise.all([
      sb.from('project_manuals').select('*').order('created_at', { ascending: false }),
      sb.from('knowledge_articles').select('id,title,summary,category,sap_activate_phase,created_at').order('created_at', { ascending: false }),
      getProjects(),
    ])
    if (!rM.error) setManuals(rM.data ?? [])
    if (!rA.error) setArticles(rA.data ?? [])
    if (!rP.error) setProjects(rP.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const projMap = Object.fromEntries(projects.map(p=>[p.id, p]))

  const filteredManuals = manuals.filter(m =>
    !search || m.title.toLowerCase().includes(search.toLowerCase()) || m.file_name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredArticles = articles.filter(a => {
    if (filterCat && a.category !== filterCat) return false
    if (search) return a.title.toLowerCase().includes(search.toLowerCase())
    return true
  })

  async function handleGenerateStatusReport() {
    setGerandoReport(true)
    try {
      const result = await generateWeeklyStatusReport(organization?.name ?? undefined)
      if (!result.ok) toast(result.reason, 'warn')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao gerar status report.', 'error')
    } finally {
      setGerandoReport(false)
    }
  }

  const mimeIcon = (mime: string | null) => {
    if (!mime) return '📄'
    if (mime.includes('pdf')) return '📕'
    if (mime.includes('word') || mime.includes('doc')) return '📘'
    if (mime.includes('sheet') || mime.includes('excel')) return '📗'
    if (mime.includes('image')) return '🖼️'
    return '📄'
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">Gestão</div>
          <h1>Documentos</h1>
          <p className="page-header__sub">Central de documentos e base de conhecimento</p>
        </div>
        <div className="page-header__actions">
          <button className="btn-secondary" onClick={handleGenerateStatusReport} disabled={gerandoReport}>
            {gerandoReport ? 'Gerando…' : '📄 Status Report Semanal'}
          </button>
          <div style={{ display:'flex', gap:'.25rem', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'.2rem' }}>
            {(['manuals','kb'] as const).map(v => (
              <button key={v} onClick={() => setTab(v)}
                style={{ background: tab===v?'var(--surface)':'none', border:'none', borderRadius:'var(--r-sm)', padding:'.3rem .625rem', fontSize:'.75rem', fontWeight: tab===v?600:400, color: tab===v?'var(--text)':'var(--subtle)', boxShadow: tab===v?'var(--shadow-xs)':'none' }}>
                {v==='manuals' ? '📁 Manuais' : '📚 Base de Conhecimento'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="page-header__sub" style={{ marginTop:'-.5rem', marginBottom:'1rem' }}>
        O status report gera um PDF com uma página por projeto ativo (health, budget, marcos, riscos e issues) — pronto para enviar ao cliente na atualização semanal.
      </p>

      {/* Search */}
      <div className="filter-bar">
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar documentos…" style={{ flex:1 }} />
        {tab === 'kb' && (
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
            <option value="">Todas as categorias</option>
            {Object.entries(CAT_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        )}
        {(search||filterCat) && (
          <button className="btn-ghost" style={{fontSize:'.75rem'}} onClick={()=>{setSearch('');setFilterCat('')}}>Limpar</button>
        )}
      </div>

      {loading ? (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'1rem'}}>
          {[1,2,3,4,5,6].map(i=><div key={i} style={{height:100,borderRadius:'var(--r-lg)'}} className="skeleton"/>)}
        </div>
      ) : tab === 'manuals' ? (
        filteredManuals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📁</div>
            <div className="empty-state__title">Nenhum manual encontrado</div>
            <p className="empty-state__desc">Manuais são adicionados dentro dos projetos.</p>
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'.75rem'}}>
            {filteredManuals.map(m => (
              <div key={m.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'1rem', boxShadow:'var(--shadow-sm)', display:'flex', gap:'.875rem', alignItems:'flex-start' }}>
                <div style={{ fontSize:'2rem', flexShrink:0 }}>{mimeIcon(m.mime_type)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'.9375rem', marginBottom:'.25rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.title}</div>
                  <div style={{ fontSize:'.75rem', color:'var(--subtle)' }}>{m.file_name}</div>
                  <div style={{ display:'flex', gap:'.5rem', marginTop:'.5rem', flexWrap:'wrap', alignItems:'center' }}>
                    {m.project_id && projMap[m.project_id] && (
                      <span className="badge badge--brand">{projMap[m.project_id].code}</span>
                    )}
                    {m.version && <span className="badge">v{m.version}</span>}
                    {m.file_size && <span style={{ fontSize:'.625rem', color:'var(--subtle-2)' }}>{fileSize(m.file_size)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        filteredArticles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📚</div>
            <div className="empty-state__title">Nenhum artigo encontrado</div>
            <p className="empty-state__desc">Crie artigos na base de conhecimento via IA & Conhecimento.</p>
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'.75rem'}}>
            {filteredArticles.map(a => (
              <div key={a.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'1rem', boxShadow:'var(--shadow-sm)', borderLeft:`3px solid ${CAT_COLOR[a.category]??'#94A3B8'}` }}>
                <div style={{ display:'flex', gap:'.5rem', marginBottom:'.5rem', flexWrap:'wrap' }}>
                  <span className="badge" style={{ background:(CAT_COLOR[a.category]??'#94A3B8')+'22', color: CAT_COLOR[a.category]??'#94A3B8', borderColor:(CAT_COLOR[a.category]??'#94A3B8')+'44' }}>
                    {CAT_LABEL[a.category]??a.category}
                  </span>
                  {a.sap_activate_phase && <span className="badge badge--brand">{a.sap_activate_phase}</span>}
                </div>
                <div style={{ fontWeight:700, fontSize:'.9375rem', marginBottom:'.25rem' }}>{a.title}</div>
                {a.summary && <p style={{ fontSize:'.8125rem', color:'var(--subtle)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{a.summary}</p>}
                <div style={{ fontSize:'.625rem', color:'var(--subtle-2)', marginTop:'.5rem' }}>
                  {new Date(a.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
