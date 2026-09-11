import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getProjects } from '../lib/api'
import type { Project } from '../types/app.types'

type Profile = {
  id: string; full_name: string | null
  email: string | null; role: string; created_at: string
}
type Member = {
  id: string; user_id: string; project_id: string; role: string
  profile: { full_name: string | null; email: string | null } | null
}

type Props = { role: string }

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador', manager: 'Gerente',
  consultant: 'Consultor', customer: 'Cliente',
}
const ROLE_COLOR: Record<string, string> = {
  admin: '#7C3AED', manager: '#0A6ED1',
  consultant: '#16A34A', customer: '#F59E0B',
}

type Tab = 'usuarios' | 'alocacoes'

export default function TeamManagePage({ role: userRole }: Props) {
  const { profile } = useAuth()
  const [tab,      setTab]      = useState<Tab>('usuarios')
  const [members,  setMembers]  = useState<Profile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [allocations, setAllocations] = useState<Member[]>([])
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState<string | null>(null)
  const [search,   setSearch]   = useState('')
  // form novo usuário
  const [showForm, setShowForm] = useState(false)
  const [email,    setEmail]    = useState('')
  const [fullName, setFullName] = useState('')
  const [newRole,  setNewRole]  = useState('consultant')
  const [saving,   setSaving]   = useState(false)
  // editar usuário existente
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editName,    setEditName]    = useState('')
  const [editSaving,  setEditSaving]  = useState(false)
  // form alocar membro
  const [showAlloc,   setShowAlloc]   = useState(false)
  const [allocProject,setAllocProject]= useState('')
  const [allocUser,   setAllocUser]   = useState('')
  const [allocRole,   setAllocRole]   = useState('consultant')
  const [savingAlloc, setSavingAlloc] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const canManage = userRole === 'admin' || userRole === 'manager'

  async function loadAll() {
    setLoading(true)
    const [rP, rM, rA] = await Promise.all([
      sb.from('profiles').select('id,full_name,email,role,created_at').order('role').order('full_name'),
      getProjects(),
      sb.from('project_members').select('id,user_id,project_id,role,profile:profiles!project_members_user_id_fkey(full_name,email)').order('created_at', { ascending: false }),
    ])
    if (!rP.error) setMembers(rP.data ?? [])
    if (!rM.error) setProjects(rM.data ?? [])
    if (!rA.error) setAllocations(rA.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadAll() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSaving(true); setErro(null)
    try {
      // Verifica se já existe perfil com esse email
      const { data: existing } = await sb.from('profiles')
        .select('id').eq('email', email.trim().toLowerCase()).maybeSingle()
      if (existing) {
        // Já tem perfil (ex: já aceitou um convite antes) — só atualiza o cargo
        const { error } = await sb.from('profiles').update({ role: newRole })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        // Não existe perfil ainda: NÃO dá pra inserir manualmente (RLS só permite
        // auto-inserção). O perfil é criado pelo trigger handle_new_user() quando
        // a pessoa aceita o convite — a Edge Function já manda organization_id/role
        // nos metadados para ela entrar direto na organização certa.
        const { data: { session } } = await supabase.auth.getSession()
        const { error: inviteErr } = await supabase.functions.invoke('invite-user', {
          body: { email: email.trim().toLowerCase(), full_name: fullName.trim() || null, role: newRole },
          headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        })
        if (inviteErr) throw inviteErr
      }
      setEmail(''); setFullName(''); setNewRole('consultant')
      setShowForm(false); void loadAll()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao adicionar usuário.')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(m: Profile) {
    setEditingId(m.id)
    setEditName(m.full_name ?? '')
  }

  async function saveEdit(memberId: string) {
    setEditSaving(true)
    const { error } = await sb.from('profiles').update({ full_name: editName.trim() || null }).eq('id', memberId)
    if (error) setErro(error.message)
    else { setEditingId(null); void loadAll() }
    setEditSaving(false)
  }

  async function changeRole(memberId: string, newR: string) {
    if (!confirm(`Alterar perfil para "${ROLE_LABEL[newR]}"?`)) return
    const { error } = await sb.from('profiles').update({ role: newR }).eq('id', memberId)
    if (error) setErro(error.message)
    else void loadAll()
  }

  async function handleAllocate(e: React.FormEvent) {
    e.preventDefault()
    if (!allocProject || !allocUser) return
    setSavingAlloc(true); setErro(null)
    const { error } = await sb.from('project_members').upsert({
      organization_id: profile?.organization_id,
      project_id: allocProject,
      user_id:    allocUser,
      role:       allocRole,
      added_by:   profile?.id,
    }, { onConflict: 'project_id,user_id' })
    if (error) { setErro(error.message); setSavingAlloc(false); return }
    setAllocProject(''); setAllocUser(''); setAllocRole('consultant')
    setShowAlloc(false); void loadAll()
    setSavingAlloc(false)
  }

  async function removeAlloc(id: string) {
    if (!confirm('Remover membro do projeto?')) return
    await sb.from('project_members').delete().eq('id', id)
    void loadAll()
  }

  const filteredMembers = members.filter(m =>
    !search ||
    (m.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (m.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const consultants = members.filter(m => ['consultant','manager'].includes(m.role))
  const projMap = Object.fromEntries(projects.map(p => [p.id, p]))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">Administração</div>
          <h1>Usuários & Alocações</h1>
          <p className="page-header__sub">
            {members.length} usuário{members.length !== 1 ? 's' : ''} · {allocations.length} alocação{allocations.length !== 1 ? 'ões' : ''}
          </p>
        </div>
        {canManage && (
          <div className="page-header__actions">
            {tab === 'usuarios' && (
              <button onClick={() => { setShowForm(v => !v); setShowAlloc(false) }}>
                {showForm ? '✕ Cancelar' : '+ Novo usuário'}
              </button>
            )}
            {tab === 'alocacoes' && (
              <button onClick={() => { setShowAlloc(v => !v); setShowForm(false) }}>
                {showAlloc ? '✕ Cancelar' : '+ Alocar membro'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn${tab === 'usuarios' ? ' tab-btn--active' : ''}`}
          onClick={() => setTab('usuarios')}>👤 Usuários</button>
        <button className={`tab-btn${tab === 'alocacoes' ? ' tab-btn--active' : ''}`}
          onClick={() => setTab('alocacoes')}>📋 Alocações por Projeto</button>
      </div>

      {erro && (
        <div style={{ background:'var(--danger-bg)', color:'var(--danger)', border:'1px solid #fecaca', borderRadius:'var(--r)', padding:'.625rem 1rem', fontSize:'.875rem', marginBottom:'1rem' }}>
          {erro} <button className="btn-ghost btn-sm" onClick={() => setErro(null)} style={{ marginLeft:'.5rem' }}>✕</button>
        </div>
      )}

      {/* ── TAB USUÁRIOS ───────────────────────────────── */}
      {tab === 'usuarios' && (
        <>
          {/* Form novo usuário */}
          {showForm && canManage && (
            <div className="card" style={{ marginBottom:'1.25rem' }}>
              <div className="card__header">
                <span className="card__title">Adicionar usuário</span>
              </div>
              <div className="card__body">
                <form onSubmit={handleCreate}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>E-mail *</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="usuario@empresa.com" required autoFocus />
                    </div>
                    <div className="form-group">
                      <label>Nome completo</label>
                      <input value={fullName} onChange={e => setFullName(e.target.value)}
                        placeholder="Nome do usuário" />
                    </div>
                    <div className="form-group">
                      <label>Perfil de acesso</label>
                      <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                        {userRole === 'admin' && <option value="admin">Administrador</option>}
                        <option value="manager">Gerente de Projetos</option>
                        <option value="consultant">Consultor</option>
                        <option value="customer">Cliente</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'.5rem', justifyContent:'flex-end' }}>
                    <button type="button" className="btn-secondary btn-sm"
                      onClick={() => setShowForm(false)}>Cancelar</button>
                    <button type="submit" disabled={saving}>
                      {saving ? 'Salvando…' : '✓ Adicionar'}
                    </button>
                  </div>
                </form>
                <div style={{ marginTop:'.875rem', padding:'.75rem', background:'var(--info-bg)', borderRadius:'var(--r)', fontSize:'.8125rem', color:'var(--info)' }}>
                  ℹ️ Um e-mail de convite real será enviado. O usuário define a senha pelo link recebido.
                </div>
              </div>
            </div>
          )}

          {/* Filtro */}
          <div className="filter-bar">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar usuário…" style={{ flex:1 }} />
            {search && (
              <button className="btn-ghost btn-sm" onClick={() => setSearch('')}>Limpar</button>
            )}
          </div>

          {/* Lista por perfil */}
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
              {[1,2,3,4].map(i => <div key={i} style={{ height:56, borderRadius:'var(--r)' }} className="skeleton" />)}
            </div>
          ) : (
            ['admin','manager','consultant','customer'].map(roleKey => {
              const group = filteredMembers.filter(m => m.role === roleKey)
              if (!group.length) return null
              return (
                <div key={roleKey} style={{ marginBottom:'1.5rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.5rem' }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background: ROLE_COLOR[roleKey] }} />
                    <span style={{ fontSize:'.6875rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--subtle)' }}>
                      {ROLE_LABEL[roleKey]} ({group.length})
                    </span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Usuário</th><th>E-mail</th><th>Perfil</th>
                          <th>Projetos alocados</th>
                          {canManage && <th>Alterar perfil</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {group.map(m => {
                          const projetos = allocations.filter(a => a.user_id === m.id)
                          return (
                            <tr key={m.id}>
                              <td>
                                <div style={{ display:'flex', alignItems:'center', gap:'.625rem' }}>
                                  <div style={{ width:32, height:32, borderRadius:'50%', background: ROLE_COLOR[m.role]+'22', color: ROLE_COLOR[m.role], display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'.75rem', flexShrink:0 }}>
                                    {(m.full_name?.[0] ?? m.email?.[0] ?? '?').toUpperCase()}
                                  </div>
                                  {editingId === m.id ? (
                                    <div style={{ display:'flex', gap:'.375rem', alignItems:'center' }}>
                                      <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                                        style={{ fontSize:'.8125rem', padding:'.25rem .5rem', width:160 }}
                                        onKeyDown={e => { if (e.key === 'Enter') void saveEdit(m.id); if (e.key === 'Escape') setEditingId(null) }} />
                                      <button className="btn-sm" disabled={editSaving} onClick={() => saveEdit(m.id)}>{editSaving ? '…' : '✓'}</button>
                                      <button className="btn-ghost btn-sm" onClick={() => setEditingId(null)}>✕</button>
                                    </div>
                                  ) : (
                                    <div>
                                      <div style={{ display:'flex', alignItems:'center', gap:'.375rem' }}>
                                        <span style={{ fontWeight:600, fontSize:'.875rem' }}>{m.full_name ?? '—'}</span>
                                        {canManage && (
                                          <button className="btn-ghost btn-sm" title="Editar nome" style={{ padding:0, fontSize:'.6875rem' }}
                                            onClick={() => startEdit(m)}>✏️</button>
                                        )}
                                      </div>
                                      {m.id === profile?.id && (
                                        <span className="badge badge--brand" style={{ fontSize:'.5625rem' }}>Você</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td style={{ fontSize:'.8125rem', color:'var(--subtle)' }}>{m.email}</td>
                              <td>
                                <span className="badge" style={{ background: ROLE_COLOR[m.role]+'22', color: ROLE_COLOR[m.role], borderColor: ROLE_COLOR[m.role]+'44' }}>
                                  {ROLE_LABEL[m.role] ?? m.role}
                                </span>
                              </td>
                              <td>
                                {projetos.length > 0 ? (
                                  <div style={{ display:'flex', gap:'.25rem', flexWrap:'wrap' }}>
                                    {projetos.map(a => (
                                      <span key={a.id} className="badge badge--brand" style={{ fontSize:'.6875rem' }}>
                                        {projMap[a.project_id]?.code ?? '—'}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ fontSize:'.8125rem', color:'var(--subtle-2)' }}>Nenhum</span>
                                )}
                              </td>
                              {canManage && (
                                <td>
                                  {m.id !== profile?.id ? (
                                    <select value={m.role} onChange={e => changeRole(m.id, e.target.value)}
                                      style={{ width:'auto', fontSize:'.75rem', padding:'.25rem .5rem', borderRadius:'var(--r-sm)' }}>
                                      {userRole === 'admin' && <option value="admin">Administrador</option>}
                                      <option value="manager">Gerente</option>
                                      <option value="consultant">Consultor</option>
                                      <option value="customer">Cliente</option>
                                    </select>
                                  ) : (
                                    <span style={{ fontSize:'.75rem', color:'var(--subtle-2)' }}>—</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          )}
        </>
      )}

      {/* ── TAB ALOCAÇÕES ──────────────────────────────── */}
      {tab === 'alocacoes' && (
        <>
          {/* Form alocar */}
          {showAlloc && canManage && (
            <div className="card" style={{ marginBottom:'1.25rem' }}>
              <div className="card__header">
                <span className="card__title">Alocar membro ao projeto</span>
              </div>
              <div className="card__body">
                <form onSubmit={handleAllocate}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Projeto *</label>
                      <select value={allocProject} onChange={e => setAllocProject(e.target.value)} required>
                        <option value="">— Selecione o projeto —</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Usuário *</label>
                      <select value={allocUser} onChange={e => setAllocUser(e.target.value)} required>
                        <option value="">— Selecione o usuário —</option>
                        {consultants.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.full_name ?? c.email} ({ROLE_LABEL[c.role]})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Papel no projeto</label>
                      <select value={allocRole} onChange={e => setAllocRole(e.target.value)}>
                        <option value="manager">Gerente</option>
                        <option value="consultant">Consultor</option>
                        <option value="viewer">Visualizador</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'.5rem', justifyContent:'flex-end' }}>
                    <button type="button" className="btn-secondary btn-sm"
                      onClick={() => setShowAlloc(false)}>Cancelar</button>
                    <button type="submit" disabled={savingAlloc || !allocProject || !allocUser}>
                      {savingAlloc ? 'Alocando…' : '✓ Alocar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Alocações agrupadas por projeto */}
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
              {[1,2,3].map(i => <div key={i} style={{ height:80, borderRadius:'var(--r)' }} className="skeleton" />)}
            </div>
          ) : allocations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">👥</div>
              <div className="empty-state__title">Nenhuma alocação</div>
              <p className="empty-state__desc">Clique em "+ Alocar membro" para associar consultores aos projetos.</p>
            </div>
          ) : (
            (() => {
              const byProject: Record<string, Member[]> = {}
              allocations.forEach(a => {
                if (!byProject[a.project_id]) byProject[a.project_id] = []
                byProject[a.project_id].push(a)
              })
              return Object.entries(byProject).map(([projId, mems]) => {
                const proj = projMap[projId]
                return (
                  <div key={projId} style={{ marginBottom:'1.5rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.5rem' }}>
                      <span className="badge badge--brand" style={{ fontSize:'.75rem' }}>{proj?.code ?? '—'}</span>
                      <span style={{ fontWeight:700, fontSize:'.9375rem' }}>{proj?.name ?? projId}</span>
                      <span style={{ fontSize:'.75rem', color:'var(--subtle)' }}>({mems.length} membro{mems.length !== 1 ? 's' : ''})</span>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr><th>Membro</th><th>E-mail</th><th>Papel</th>{canManage && <th></th>}</tr>
                        </thead>
                        <tbody>
                          {mems.map(m => {
                            const prof = m.profile as { full_name: string | null; email: string | null } | null
                            return (
                              <tr key={m.id}>
                                <td>
                                  <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                                    <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--brand-light)', color:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'.6875rem', flexShrink:0 }}>
                                      {(prof?.full_name?.[0] ?? prof?.email?.[0] ?? '?').toUpperCase()}
                                    </div>
                                    <span style={{ fontWeight:600, fontSize:'.875rem' }}>{prof?.full_name ?? '—'}</span>
                                  </div>
                                </td>
                                <td style={{ fontSize:'.8125rem', color:'var(--subtle)' }}>{prof?.email ?? '—'}</td>
                                <td>
                                  <span className="badge">{m.role === 'manager' ? 'Gerente' : m.role === 'viewer' ? 'Visualizador' : 'Consultor'}</span>
                                </td>
                                {canManage && (
                                  <td>
                                    <button className="btn-ghost btn-sm btn-danger"
                                      onClick={() => removeAlloc(m.id)}>Remover</button>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })
            })()
          )}
        </>
      )}
    </div>
  )
}
