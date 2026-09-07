import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getProjects } from '../lib/api'
import type { Project } from '../types/app.types'

type Article = {
  id: string; organization_id: string; title: string; body: string
  summary: string | null; category: string; sap_activate_phase: string | null
  sap_module: string | null; tags: string[]; is_public: boolean
  view_count: number; created_by: string | null; created_at: string; updated_at: string
}

type Message = { role: 'user' | 'assistant'; content: string; articles_used?: number }

const CAT_LABEL: Record<string,string> = {
  general:'Geral', technical:'Técnico', process:'Processo',
  template:'Template', lesson_learned:'Lição Aprendida', faq:'FAQ',
}
const CAT_COLOR: Record<string,string> = {
  general:'#6b7280', technical:'#1d4ed8', process:'#16a34a',
  template:'#d97706', lesson_learned:'#7c3aed', faq:'#0891b2',
}
const SAP_PHASES = ['Descobrir','Preparar','Explorar','Realizar','Implementar','Executar']

type Props = { role: string; userId: string }

export default function KnowledgePage({ role, userId }: Props) {
  const [tab,       setTab]       = useState<'kb'|'ai'>('ai')
  const [articles,  setArticles]  = useState<Article[]>([])
  const [projects,  setProjects]  = useState<Project[]>([])
  const [selProject,setSelProject]= useState('')
  const [loading,   setLoading]   = useState(false)
  const [erro,      setErro]      = useState<string | null>(null)

  // KB
  const [filterCat,  setFilterCat]  = useState('')
  const [filterPhase,setFilterPhase]= useState('')
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState<Article | null>(null)
  const [showForm,   setShowForm]   = useState(false)

  // Artigo form
  const [artTitle,   setArtTitle]   = useState('')
  const [artBody,    setArtBody]    = useState('')
  const [artSummary, setArtSummary] = useState('')
  const [artCat,     setArtCat]     = useState('general')
  const [artPhase,   setArtPhase]   = useState('')
  const [artModule,  setArtModule]  = useState('')

  // AI Chat
  const [messages,  setMessages]  = useState<Message[]>([])
  const [question,  setQuestion]  = useState('')
  const [asking,    setAsking]    = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const canEdit = role === 'admin' || role === 'manager' || role === 'consultant'

  async function loadArticles() {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any).from('knowledge_articles').select('*').order('created_at', { ascending: false })
    if (filterCat)   q = q.eq('category', filterCat)
    if (filterPhase) q = q.eq('sap_activate_phase', filterPhase)
    const { data, error } = await q
    if (error) setErro(typeof error === 'object' ? (error as Record<string,unknown>)['message'] as string : String(error))
    else setArticles(data ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadArticles() }, [filterCat, filterPhase])

  useEffect(() => {
    getProjects().then(({ data }) => setProjects(data ?? []))
  }, [])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  const filtered = articles.filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.summary ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function saveArticle() {
    if (!artTitle.trim() || !artBody.trim()) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('knowledge_articles').insert({
      title: artTitle, body: artBody, summary: artSummary || null,
      category: artCat, sap_activate_phase: artPhase || null,
      sap_module: artModule || null, created_by: userId,
    })
    if (error) { setErro(typeof error === 'object' ? (error as Record<string,unknown>)['message'] as string : String(error)); return }
    setArtTitle(''); setArtBody(''); setArtSummary(''); setArtPhase(''); setArtModule('')
    setShowForm(false); void loadArticles()
  }

  async function askAI() {
    if (!question.trim() || asking) return
    const q = question.trim()
    setQuestion('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setAsking(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-ai`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ question: q, project_id: selProject || null }),
        }
      )
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        articles_used: data.articles_used,
      }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Erro: ${e instanceof Error ? e.message : 'Tente novamente.'}`,
      }])
    }
    setAsking(false)
  }

  return (
    <div className="pagina">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Knowledge Base</h1>
          <p className="sutil">Base de conhecimento SAP + Assistente IA</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:'1.5rem' }}>
        {([['ai','🤖 Assistente IA'],['kb','📚 Base de Conhecimento']] as const).map(([id,label]) => (
          <button key={id} className="btn-ghost" onClick={() => setTab(id)}
            style={{ borderRadius:0, borderBottom: tab===id?'2px solid var(--accent)':'2px solid transparent',
              color: tab===id?'var(--accent)':'var(--subtle)', fontWeight: tab===id?700:500,
              padding:'0.625rem 1rem' }}>
            {label}
          </button>
        ))}
      </div>

      {erro && <p className="erro" style={{ marginBottom:'0.75rem' }}>{erro}</p>}

      {/* ── AI CHAT ────────────────────────────────────────────── */}
      {tab === 'ai' && (
        <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 280px)', minHeight:400 }}>
          {/* Seletor de projeto */}
          <div style={{ display:'flex', gap:'0.75rem', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap' }}>
            <select value={selProject} onChange={e=>setSelProject(e.target.value)}
              style={{ width:'auto', fontSize:'0.8125rem', padding:'0.35rem 0.6rem' }}>
              <option value="">Sem contexto de projeto</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
            <span className="sutil" style={{ fontSize:'0.75rem' }}>
              Selecione um projeto para a IA ter contexto do status atual
            </span>
          </div>

          {/* Mensagens */}
          <div ref={chatRef} style={{
            flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.875rem',
            padding:'1rem', background:'var(--surface-2)', borderRadius:'var(--radius)',
            border:'1px solid var(--border)', marginBottom:'0.75rem',
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign:'center', margin:'auto', color:'var(--subtle)' }}>
                <p style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>🤖</p>
                <p style={{ fontWeight:600 }}>Assistente SAP S/4HANA</p>
                <p style={{ fontSize:'0.8125rem', marginTop:'0.25rem' }}>
                  Pergunte sobre implementação, configuração, metodologia SAP Activate ou status do projeto.
                </p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem', justifyContent:'center', marginTop:'1rem' }}>
                  {[
                    'Como configurar NF-e no SAP?',
                    'Quais são as etapas da fase Realizar?',
                    'Como gerenciar riscos no projeto?',
                    'O que é SPED e como integrar?',
                  ].map(s => (
                    <button key={s} className="btn-outline" style={{ fontSize:'0.75rem', padding:'0.3rem 0.6rem' }}
                      onClick={() => { setQuestion(s); }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                display:'flex', justifyContent: m.role==='user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth:'80%', padding:'0.75rem 1rem',
                  borderRadius: m.role==='user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: m.role==='user' ? 'var(--accent)' : 'var(--surface)',
                  color: m.role==='user' ? '#fff' : 'var(--text)',
                  border: m.role==='user' ? 'none' : '1px solid var(--border)',
                  fontSize:'0.875rem', lineHeight:1.6,
                  whiteSpace:'pre-wrap',
                }}>
                  {m.content}
                  {m.articles_used !== undefined && m.articles_used > 0 && (
                    <p style={{ fontSize:'0.6875rem', marginTop:'0.5rem', opacity:0.7 }}>
                      📚 {m.articles_used} artigo{m.articles_used>1?'s':''} da base de conhecimento usados
                    </p>
                  )}
                </div>
              </div>
            ))}
            {asking && (
              <div style={{ display:'flex' }}>
                <div style={{ padding:'0.75rem 1rem', background:'var(--surface)',
                  border:'1px solid var(--border)', borderRadius:'12px 12px 12px 4px',
                  fontSize:'0.875rem', color:'var(--subtle)' }}>
                  Consultando base de conhecimento e gerando resposta…
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <input
              value={question}
              onChange={e=>setQuestion(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); void askAI() }}}
              placeholder="Digite sua pergunta sobre SAP S/4HANA…"
              style={{ flex:1 }}
              disabled={asking}
            />
            <button onClick={askAI} disabled={asking || !question.trim()}>
              {asking ? '…' : '→ Perguntar'}
            </button>
          </div>
        </div>
      )}

      {/* ── KNOWLEDGE BASE ─────────────────────────────────────── */}
      {tab === 'kb' && (
        <div>
          {/* Toolbar */}
          <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', marginBottom:'1rem', alignItems:'center' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Buscar artigos…" style={{ flex:1, minWidth:200 }} />
            <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
              style={{ width:'auto', fontSize:'0.8125rem' }}>
              <option value="">Todas as categorias</option>
              {Object.entries(CAT_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
            <select value={filterPhase} onChange={e=>setFilterPhase(e.target.value)}
              style={{ width:'auto', fontSize:'0.8125rem' }}>
              <option value="">Todas as fases</option>
              {SAP_PHASES.map(f=><option key={f} value={f}>{f}</option>)}
            </select>
            {canEdit && (
              <button className="btn-sm" onClick={()=>setShowForm(v=>!v)}>+ Novo artigo</button>
            )}
          </div>

          {/* Form novo artigo */}
          {showForm && canEdit && (
            <div className="fin-form" style={{ marginBottom:'1.25rem' }}>
              <div className="modal-grid">
                <div style={{ gridColumn:'1/-1' }}>
                  <label>Título *</label>
                  <input value={artTitle} onChange={e=>setArtTitle(e.target.value)} />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label>Resumo (aparece na busca)</label>
                  <input value={artSummary} onChange={e=>setArtSummary(e.target.value)} />
                </div>
                <div><label>Categoria</label>
                  <select value={artCat} onChange={e=>setArtCat(e.target.value)}>
                    {Object.entries(CAT_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div><label>Fase SAP Activate</label>
                  <select value={artPhase} onChange={e=>setArtPhase(e.target.value)}>
                    <option value="">— Nenhuma —</option>
                    {SAP_PHASES.map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div><label>Módulo SAP</label>
                  <input value={artModule} onChange={e=>setArtModule(e.target.value)} placeholder="Ex: FI, MM, SD" />
                </div>
              </div>
              <label>Conteúdo *</label>
              <textarea rows={8} value={artBody} onChange={e=>setArtBody(e.target.value)}
                placeholder="Escreva o conteúdo do artigo aqui…" />
              <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem' }}>
                <button onClick={saveArticle} disabled={!artTitle.trim()||!artBody.trim()}>Salvar artigo</button>
                <button className="btn-outline" onClick={()=>setShowForm(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {loading && <p className="sutil">Carregando…</p>}

          {/* Lista de artigos */}
          {!selected ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'0.75rem' }}>
              {filtered.map(a => (
                <div key={a.id} className="pcard" onClick={()=>setSelected(a)}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
                    <span className="badge" style={{
                      background: CAT_COLOR[a.category]+'22',
                      color: CAT_COLOR[a.category],
                      borderColor: CAT_COLOR[a.category]+'44',
                    }}>{CAT_LABEL[a.category]}</span>
                    {a.sap_activate_phase && <span className="badge badge--ev">{a.sap_activate_phase}</span>}
                  </div>
                  <h3 style={{ fontWeight:700, fontSize:'0.9375rem', marginBottom:'0.375rem' }}>{a.title}</h3>
                  {a.summary && <p className="pcard__desc">{a.summary}</p>}
                  <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem' }}>
                    {a.sap_module && <span className="badge">{a.sap_module}</span>}
                    <span className="sutil" style={{ fontSize:'0.6875rem', marginLeft:'auto' }}>
                      {new Date(a.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && !loading && (
                <p className="sutil" style={{ gridColumn:'1/-1', textAlign:'center', padding:'2rem' }}>
                  Nenhum artigo encontrado.{canEdit && ' Crie o primeiro clicando em "+ Novo artigo".'}
                </p>
              )}
            </div>
          ) : (
            /* Artigo aberto */
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)',
              borderRadius:'var(--radius-lg)', padding:'1.5rem', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
                <button className="btn-ghost" onClick={()=>setSelected(null)}>← Voltar</button>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  <span className="badge" style={{
                    background: CAT_COLOR[selected.category]+'22',
                    color: CAT_COLOR[selected.category],
                  }}>{CAT_LABEL[selected.category]}</span>
                  {selected.sap_activate_phase && <span className="badge badge--ev">{selected.sap_activate_phase}</span>}
                  {selected.sap_module && <span className="badge">{selected.sap_module}</span>}
                </div>
              </div>
              <h2 style={{ fontSize:'1.375rem', fontWeight:800, letterSpacing:'-.02em', marginBottom:'0.5rem' }}>
                {selected.title}
              </h2>
              {selected.summary && <p className="sutil" style={{ marginBottom:'1.25rem' }}>{selected.summary}</p>}
              <div style={{ whiteSpace:'pre-wrap', fontSize:'0.9375rem', lineHeight:1.75, color:'var(--text-2)' }}>
                {selected.body}
              </div>
              <p className="sutil" style={{ marginTop:'1.5rem', fontSize:'0.75rem' }}>
                Criado em {new Date(selected.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
