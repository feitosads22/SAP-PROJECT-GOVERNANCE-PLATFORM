import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const CATEGORIES = [
  { v:'general',         l:'Geral' },
  { v:'blueprint',       l:'Business Blueprint' },
  { v:'functional_design',l:'Desenho Funcional' },
  { v:'technical_design',l:'Desenho Técnico' },
  { v:'test_plan',       l:'Plano de Testes' },
  { v:'evidence',        l:'Evidência' },
  { v:'minutes',         l:'Ata de Reunião' },
  { v:'schedule',        l:'Cronograma' },
  { v:'report',          l:'Relatório' },
  { v:'manual',          l:'Manual' },
  { v:'go_live',         l:'Go-Live' },
  { v:'change_request',  l:'Change Request' },
]

type Doc = {
  id:string; title:string; description:string|null; category:string
  storage_path:string; file_name:string; file_size:number|null
  mime_type:string|null; version:string|null; created_at:string
  uploaded_by:string|null
}

type Props = { projectId: string; role: string }

function fileSize(b:number|null){
  if(!b)return''
  if(b>=1048576)return`${(b/1048576).toFixed(1)} MB`
  if(b>=1024)return`${Math.round(b/1024)} KB`
  return`${b} B`
}
function mimeIcon(m:string|null){
  if(!m)return'📄'
  if(m.includes('pdf'))return'📕'
  if(m.includes('word')||m.includes('doc'))return'📘'
  if(m.includes('sheet')||m.includes('excel'))return'📗'
  if(m.includes('image'))return'🖼️'
  if(m.includes('zip')||m.includes('rar'))return'📦'
  return'📄'
}

export default function ProjectDocuments({ projectId, role }: Props) {
  const { profile } = useAuth()
  const [docs,    setDocs]    = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [erro,    setErro]    = useState<string|null>(null)
  const [filterCat, setFilterCat] = useState('')
  const [search,    setSearch]    = useState('')
  const [uploading, setUploading] = useState(false)
  const [showForm,  setShowForm]  = useState(false)
  const [title,     setTitle]     = useState('')
  const [desc,      setDesc]      = useState('')
  const [cat,       setCat]       = useState('general')
  const [version,   setVersion]   = useState('1.0')
  const [file,      setFile]      = useState<File|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const canEdit = ['admin','manager','consultant'].includes(role)

  async function load() {
    setLoading(true)
    const { data, error } = await sb.from('project_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (error) setErro(error.message)
    else setDocs(data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [projectId])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !title.trim()) return
    setUploading(true); setErro(null)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${projectId}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage
        .from('project-documents')
        .upload(path, file, { contentType: file.type })
      if (upErr) throw upErr

      const { error: dbErr } = await sb.from('project_documents').insert({
        project_id:   projectId,
        title:        title.trim(),
        description:  desc.trim() || null,
        category:     cat,
        storage_path: path,
        file_name:    file.name,
        file_size:    file.size,
        mime_type:    file.type || `application/${ext}`,
        version:      version || '1.0',
        uploaded_by:  profile?.id,
      })
      if (dbErr) throw dbErr
      setTitle(''); setDesc(''); setCat('general'); setVersion('1.0'); setFile(null)
      setShowForm(false); void load()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : String(err))
    }
    setUploading(false)
  }

  async function handleDownload(doc: Doc) {
    const { data } = await supabase.storage
      .from('project-documents')
      .createSignedUrl(doc.storage_path, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(doc: Doc) {
    if (!confirm(`Remover "${doc.title}"?`)) return
    await supabase.storage.from('project-documents').remove([doc.storage_path])
    await sb.from('project_documents').delete().eq('id', doc.id)
    void load()
  }

  const filtered = docs.filter(d => {
    if (filterCat && d.category !== filterCat) return false
    if (search) return d.title.toLowerCase().includes(search.toLowerCase()) || d.file_name.toLowerCase().includes(search.toLowerCase())
    return true
  })

  const byCategory: Record<string,Doc[]> = {}
  filtered.forEach(d => {
    if (!byCategory[d.category]) byCategory[d.category] = []
    byCategory[d.category].push(d)
  })

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', gap:'.75rem', flexWrap:'wrap', alignItems:'center', marginBottom:'1rem' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar documentos…" style={{ flex:1, minWidth:180, maxWidth:280 }} />
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ width:'auto', fontSize:'.8125rem' }}>
          <option value="">Todas as categorias</option>
          {CATEGORIES.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
        {(filterCat||search) && (
          <button className="btn-ghost btn-sm" onClick={()=>{setFilterCat('');setSearch('')}}>Limpar</button>
        )}
        {canEdit && (
          <button className="btn-sm" onClick={()=>setShowForm(v=>!v)}>
            {showForm ? '✕ Cancelar' : '+ Adicionar'}
          </button>
        )}
      </div>

      {/* Upload form */}
      {showForm && canEdit && (
        <form onSubmit={handleUpload} style={{ background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'1.25rem', marginBottom:'1.25rem' }}>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn:'1/-1' }}>
              <label>Título do documento *</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} required placeholder="Ex: Blueprint FI v1.0" />
            </div>
            <div className="form-group">
              <label>Categoria</label>
              <select value={cat} onChange={e=>setCat(e.target.value)}>
                {CATEGORIES.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Versão</label>
              <input value={version} onChange={e=>setVersion(e.target.value)} placeholder="1.0" />
            </div>
            <div className="form-group" style={{ gridColumn:'1/-1' }}>
              <label>Descrição (opcional)</label>
              <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} />
            </div>
          </div>
          <div>
            <label>Arquivo *</label>
            <input ref={fileRef} type="file" style={{ display:'none' }}
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <div className="upload-area" onClick={()=>fileRef.current?.click()}>
              <span style={{ fontSize:'1.5rem' }}>{file ? mimeIcon(file.type) : '📎'}</span>
              <span style={{ fontSize:'.875rem', fontWeight:600 }}>
                {file ? file.name : 'Clique para selecionar o arquivo'}
              </span>
              {file && <span style={{ fontSize:'.75rem', color:'var(--subtle)' }}>{fileSize(file.size)}</span>}
            </div>
          </div>
          {erro && <p className="erro" style={{ marginTop:'.5rem' }}>{erro}</p>}
          <div style={{ display:'flex', gap:'.5rem', marginTop:'.875rem', justifyContent:'flex-end' }}>
            <button type="button" className="btn-secondary btn-sm" onClick={()=>setShowForm(false)}>Cancelar</button>
            <button type="submit" disabled={uploading || !file || !title.trim()}>
              {uploading ? 'Enviando…' : '↑ Enviar'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
          {[1,2,3].map(i=><div key={i} style={{ height:56, borderRadius:'var(--r)' }} className="skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📁</div>
          <div className="empty-state__title">Nenhum documento</div>
          <p className="empty-state__desc">{canEdit ? 'Clique em "+ Adicionar" para fazer upload.' : 'Nenhum documento adicionado ainda.'}</p>
        </div>
      ) : (
        /* Agrupado por categoria */
        Object.entries(byCategory).map(([catKey, catDocs]) => {
          const catLabel = CATEGORIES.find(c=>c.v===catKey)?.l ?? catKey
          return (
            <div key={catKey} style={{ marginBottom:'1.5rem' }}>
              <div style={{ fontSize:'.6875rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--subtle)', marginBottom:'.5rem' }}>
                📂 {catLabel} ({catDocs.length})
              </div>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {catDocs.map(doc => (
                      <tr key={doc.id}>
                        <td style={{ width:36, paddingRight:0 }}>
                          <span style={{ fontSize:'1.25rem' }}>{mimeIcon(doc.mime_type)}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight:600, fontSize:'.875rem' }}>{doc.title}</div>
                          {doc.description && <div style={{ fontSize:'.75rem', color:'var(--subtle)' }}>{doc.description}</div>}
                        </td>
                        <td style={{ whiteSpace:'nowrap' }}>
                          {doc.version && <span className="badge">v{doc.version}</span>}
                        </td>
                        <td style={{ fontSize:'.75rem', color:'var(--subtle-2)', whiteSpace:'nowrap' }}>
                          {fileSize(doc.file_size)}
                        </td>
                        <td style={{ fontSize:'.75rem', color:'var(--subtle-2)', whiteSpace:'nowrap' }}>
                          {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                          <button className="btn-ghost btn-sm" onClick={()=>handleDownload(doc)}>⬇ Baixar</button>
                          {['admin','manager'].includes(role) && (
                            <button className="btn-ghost btn-sm btn-danger" style={{ marginLeft:'.25rem' }}
                              onClick={()=>handleDelete(doc)}>✕</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
