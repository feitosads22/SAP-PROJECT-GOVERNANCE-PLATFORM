import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Link = {
  id: string; organization_id: string; project_id: string;
  customer_id: string; access_level: string; invited_by: string | null; created_at: string;
  profiles?: { full_name: string | null; email: string | null }
}
type Update = {
  id: string; organization_id: string; project_id: string;
  title: string; body: string; update_type: string; is_published: boolean;
  published_at: string | null; created_by: string | null; created_at: string; updated_at: string;
}
type Profile= { id: string; full_name: string | null; email: string | null; role: string }

type Props = { role: string; userId: string; overrideProjectId?: string }

const UPDATE_TYPES = ['general','milestone','risk','financial','schedule'] as const
const UPDATE_TYPE_LABEL: Record<string,string> = {
  general:'Geral', milestone:'Marco', risk:'Risco',
  financial:'Financeiro', schedule:'Prazo',
}

function err(e: unknown): string {
  if (!e) return 'Erro.'
  const r = e as Record<string,unknown>
  return typeof r['message'] === 'string' ? r['message'] : 'Erro.'
}

export default function CustomerManagePage({ role, userId, overrideProjectId }: Props) {
  const params = useParams<{ id: string }>()
  const projectId = overrideProjectId ?? params.id
  const navigate = useNavigate()
  const canEdit  = role === 'admin' || role === 'manager'

  const [links,     setLinks]     = useState<Link[]>([])
  const [updates,   setUpdates]   = useState<Update[]>([])
  const [customers, setCustomers] = useState<Profile[]>([])
  const [erro,      setErro]      = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)

  // Link form
  const [selCustomer, setSelCustomer] = useState('')
  const [selAccess,   setSelAccess]   = useState('viewer')

  // Update form
  const [updTitle,   setUpdTitle]   = useState('')
  const [updBody,    setUpdBody]    = useState('')
  const [updType,    setUpdType]    = useState('general')
  const [updPublish, setUpdPublish] = useState(false)
  const [showUpdForm, setShowUpdForm] = useState(false)

  async function load() {
    if (!projectId) return
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const [rLinks, rUpdates, rCustomers] = await Promise.all([
      sb.from('project_customers').select('*, profiles(full_name,email)')
        .eq('project_id', projectId),
      sb.from('customer_updates').select('*')
        .eq('project_id', projectId).order('created_at', { ascending: false }),
      sb.from('profiles').select('id,full_name,email,role')
        .eq('role', 'customer'),
    ])
    if (!rLinks.error)     setLinks(rLinks.data ?? [])
    if (!rUpdates.error)   setUpdates(rUpdates.data ?? [])
    if (!rCustomers.error) setCustomers(rCustomers.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [projectId])

  async function addLink() {
    if (!selCustomer || !projectId) return
    setErro(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('project_customers')
      .upsert(
        { project_id: projectId, customer_id: selCustomer,
          access_level: selAccess, invited_by: userId },
        { onConflict: 'project_id,customer_id', ignoreDuplicates: false }
      )
    if (error) { setErro(err(error)); return }
    setSelCustomer(''); void load()
  }

  async function removeLink(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('project_customers').delete().eq('id', id)
    void load()
  }

  async function saveUpdate() {
    if (!updTitle.trim() || !updBody.trim() || !projectId) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('customer_updates').insert({
      project_id: projectId, title: updTitle, body: updBody,
      update_type: updType, is_published: updPublish,
      published_at: updPublish ? new Date().toISOString() : null,
      created_by: userId,
    })
    if (error) { setErro(err(error)); return }
    setUpdTitle(''); setUpdBody(''); setUpdPublish(false); setShowUpdForm(false)
    void load()
  }

  async function togglePublish(u: Update) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('customer_updates')
      .update({ is_published: !u.is_published, published_at: !u.is_published ? new Date().toISOString() : null })
      .eq('id', u.id)
    void load()
  }

  async function deleteUpdate(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('customer_updates').delete().eq('id', id)
    void load()
  }

  const linkedIds = new Set(links.map(l => l.customer_id))
  const available = customers.filter(c => !linkedIds.has(c.id))

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <button className="btn-ghost" style={{ fontSize:'0.8125rem', padding:'0.25rem 0' }}
            onClick={() => navigate(`/projeto/${projectId}`)}>← Kanban</button>
          <h1>Portal do Cliente</h1>
          <p className="sutil">Gerencie acesso e comunicados para os clientes deste projeto</p>
        </div>
      </div>

      {erro && <p className="erro" style={{ marginBottom:'1rem' }}>{erro}</p>}
      {loading && <p className="sutil">Carregando…</p>}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>

        {/* Clientes vinculados */}
        <section>
          <h2 className="section-title">Clientes com acesso</h2>

          {canEdit && available.length > 0 && (
            <div className="fin-form" style={{ marginBottom:'1rem' }}>
              <label>Cliente</label>
              <select value={selCustomer} onChange={e=>setSelCustomer(e.target.value)}>
                <option value="">Selecione…</option>
                {available.map(c=>(
                  <option key={c.id} value={c.id}>{c.full_name ?? c.email}</option>
                ))}
              </select>
              <label>Nível de acesso</label>
              <select value={selAccess} onChange={e=>setSelAccess(e.target.value)}>
                <option value="viewer">Viewer — só leitura</option>
                <option value="stakeholder">Stakeholder — pode comentar</option>
              </select>
              <button style={{ marginTop:'0.5rem' }}
                onClick={addLink} disabled={!selCustomer}>
                Vincular cliente
              </button>
            </div>
          )}

          {links.length === 0 ? (
            <p className="sutil">Nenhum cliente vinculado.</p>
          ) : (
            <table className="tabela">
              <thead><tr><th>Cliente</th><th>Acesso</th>{canEdit && <th></th>}</tr></thead>
              <tbody>
                {links.map(l => (
                  <tr key={l.id}>
                    <td>
                      <strong>{(l.profiles as {full_name:string|null;email:string|null}|undefined)?.full_name ?? '—'}</strong>
                      <p className="sutil" style={{fontSize:'0.75rem'}}>
                        {(l.profiles as {full_name:string|null;email:string|null}|undefined)?.email}
                      </p>
                    </td>
                    <td><span className="badge">{l.access_level}</span></td>
                    {canEdit && (
                      <td><button className="btn-sm btn-sm--danger" onClick={()=>removeLink(l.id)}>✕</button></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Comunicados */}
        <section>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
            <h2 className="section-title" style={{ margin:0 }}>Comunicados</h2>
            {canEdit && (
              <button className="btn-sm" onClick={()=>setShowUpdForm(v=>!v)}>+ Novo</button>
            )}
          </div>

          {showUpdForm && canEdit && (
            <div className="fin-form" style={{ marginBottom:'1rem' }}>
              <label>Título *</label>
              <input value={updTitle} onChange={e=>setUpdTitle(e.target.value)}
                placeholder="Ex: Sprint 1 concluído" />
              <label>Tipo</label>
              <select value={updType} onChange={e=>setUpdType(e.target.value)}>
                {UPDATE_TYPES.map(t=><option key={t} value={t}>{UPDATE_TYPE_LABEL[t]}</option>)}
              </select>
              <label>Conteúdo *</label>
              <textarea rows={4} value={updBody} onChange={e=>setUpdBody(e.target.value)}
                placeholder="Descreva a atualização para o cliente…" />
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.25rem' }}>
                <input type="checkbox" id="pub" checked={updPublish}
                  onChange={e=>setUpdPublish(e.target.checked)}
                  style={{ width:'auto', display:'inline' }} />
                <label htmlFor="pub" style={{ margin:0, textTransform:'none', fontSize:'0.875rem',
                  fontWeight:500, color:'var(--text)', letterSpacing:0 }}>
                  Publicar imediatamente
                </label>
              </div>
              <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem' }}>
                <button onClick={saveUpdate} disabled={!updTitle.trim()||!updBody.trim()}>Salvar</button>
                <button className="btn-outline" onClick={()=>setShowUpdForm(false)}>Cancelar</button>
              </div>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {updates.map(u => (
              <div key={u.id} style={{
                background:'var(--surface)', border:'1px solid var(--border)',
                borderRadius:'var(--radius-sm)', padding:'0.875rem 1rem',
                display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'0.75rem',
              }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.25rem' }}>
                    <span className="badge">{UPDATE_TYPE_LABEL[u.update_type]}</span>
                    {u.is_published
                      ? <span className="badge badge--approved">Publicado</span>
                      : <span className="badge">Rascunho</span>}
                  </div>
                  <p style={{ fontWeight:600, fontSize:'0.875rem' }}>{u.title}</p>
                  <p className="sutil" style={{ fontSize:'0.75rem', marginTop:'0.125rem' }}>
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {canEdit && (
                  <div style={{ display:'flex', gap:'0.35rem', flexShrink:0 }}>
                    <button className={`btn-sm ${u.is_published ? 'btn-outline' : 'btn-sm--ok'}`}
                      onClick={()=>togglePublish(u)}>
                      {u.is_published ? 'Despublicar' : '↑ Publicar'}
                    </button>
                    <button className="btn-sm btn-sm--danger" onClick={()=>deleteUpdate(u.id)}>✕</button>
                  </div>
                )}
              </div>
            ))}
            {updates.length === 0 && <p className="sutil">Nenhum comunicado.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
