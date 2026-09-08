import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Profile = { id:string; full_name:string|null; email:string|null; role:string; created_at:string }

type Props = { role: string }

const ROLE_LABEL: Record<string,string> = {
  admin:'Administrador', manager:'Gerente', consultant:'Consultor', customer:'Cliente',
}
const ROLE_COLOR: Record<string,string> = {
  admin:'#7C3AED', manager:'#0A6ED1', consultant:'#16A34A', customer:'#F59E0B',
}

export default function TeamManagePage({ role: userRole }: Props) {
  const { profile } = useAuth()
  const [members,  setMembers]  = useState<Profile[]>([])
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState<string|null>(null)
  const [showForm, setShowForm] = useState(false)
  const [email,    setEmail]    = useState('')
  const [fullName, setFullName] = useState('')
  const [newRole,  setNewRole]  = useState('consultant')
  const [saving,   setSaving]   = useState(false)
  const [search,   setSearch]   = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const canManage = userRole === 'admin' || userRole === 'manager'

  async function load() {
    setLoading(true)
    const { data, error } = await sb.from('profiles')
      .select('id,full_name,email,role,created_at')
      .order('role').order('full_name')
    if (error) setErro(error.message)
    else setMembers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSaving(true); setErro(null)
    try {
      // Cria o usuário via auth (admin only via service role normalmente)
      // Para esta implementação: cria convite registrando na tabela de profiles
      // Na prática o usuário precisará criar conta com esse email
      const { error } = await sb.from('profiles').insert({
        email: email.trim().toLowerCase(),
        full_name: fullName.trim() || null,
        role: newRole,
        organization_id: profile?.organization_id,
      })
      if (error) throw error
      setEmail(''); setFullName(''); setNewRole('consultant')
      setShowForm(false); void load()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : String(err))
    }
    setSaving(false)
  }

  async function changeRole(memberId: string, newR: string) {
    if (!confirm(`Alterar perfil para "${ROLE_LABEL[newR]}"?`)) return
    const { error } = await sb.from('profiles').update({ role: newR }).eq('id', memberId)
    if (error) setErro(error.message)
    else void load()
  }

  const filtered = members.filter(m =>
    !search || (m.full_name??'').toLowerCase().includes(search.toLowerCase()) ||
    (m.email??'').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">Administração</div>
          <h1>Gestão de Usuários</h1>
          <p className="page-header__sub">{members.length} usuário{members.length !== 1 ? 's' : ''} na organização</p>
        </div>
        {canManage && (
          <div className="page-header__actions">
            <button onClick={() => setShowForm(v=>!v)}>
              {showForm ? '✕ Cancelar' : '+ Novo usuário'}
            </button>
          </div>
        )}
      </div>

      {/* Novo usuário form */}
      {showForm && canManage && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'1.25rem', marginBottom:'1.25rem', boxShadow:'var(--shadow-sm)' }}>
          <h3 style={{ fontWeight:700, marginBottom:'1rem', fontSize:'.9375rem' }}>Adicionar usuário</h3>
          <form onSubmit={handleCreate}>
            <div className="form-grid">
              <div className="form-group">
                <label>E-mail *</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="usuario@empresa.com" required autoFocus />
              </div>
              <div className="form-group">
                <label>Nome completo</label>
                <input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Nome do usuário" />
              </div>
              <div className="form-group">
                <label>Perfil de acesso</label>
                <select value={newRole} onChange={e=>setNewRole(e.target.value)}>
                  {userRole === 'admin' && <option value="admin">Administrador</option>}
                  <option value="manager">Gerente de Projetos</option>
                  <option value="consultant">Consultor</option>
                  <option value="customer">Cliente</option>
                </select>
              </div>
            </div>
            {erro && <p className="erro" style={{ marginBottom:'.75rem' }}>{erro}</p>}
            <div style={{ display:'flex', gap:'.5rem', justifyContent:'flex-end' }}>
              <button type="button" className="btn-secondary btn-sm" onClick={()=>setShowForm(false)}>Cancelar</button>
              <button type="submit" disabled={saving}>{saving ? 'Salvando…' : '✓ Adicionar'}</button>
            </div>
          </form>
          <div style={{ marginTop:'.875rem', padding:'.75rem', background:'var(--info-bg)', borderRadius:'var(--r)', fontSize:'.8125rem', color:'var(--info)' }}>
            ℹ️ O usuário receberá as credenciais para acessar o sistema. Certifique-se de que o e-mail está correto.
          </div>
        </div>
      )}

      {/* Filtro */}
      <div className="filter-bar" style={{ marginBottom:'1rem' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar usuário…" style={{ flex:1 }} />
        {search && <button className="btn-ghost btn-sm" onClick={()=>setSearch('')}>Limpar</button>}
      </div>

      {/* Agrupado por perfil */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
          {[1,2,3,4].map(i=><div key={i} style={{ height:56, borderRadius:'var(--r)' }} className="skeleton" />)}
        </div>
      ) : (
        ['admin','manager','consultant','customer'].map(roleKey => {
          const group = filtered.filter(m=>m.role===roleKey)
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
                      {canManage && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {group.map(m => (
                      <tr key={m.id}>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:'.625rem' }}>
                            <div style={{ width:32, height:32, borderRadius:'50%', background: ROLE_COLOR[m.role]+'22', color: ROLE_COLOR[m.role], display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'.75rem', flexShrink:0 }}>
                              {(m.full_name?.[0] ?? m.email?.[0] ?? '?').toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight:600, fontSize:'.875rem' }}>{m.full_name ?? '—'}</div>
                              {m.id === profile?.id && <span className="badge badge--brand" style={{ fontSize:'.5625rem' }}>Você</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize:'.8125rem', color:'var(--subtle)' }}>{m.email}</td>
                        <td>
                          <span className="badge" style={{
                            background: ROLE_COLOR[m.role]+'22',
                            color: ROLE_COLOR[m.role],
                            borderColor: ROLE_COLOR[m.role]+'44',
                          }}>
                            {ROLE_LABEL[m.role] ?? m.role}
                          </span>
                        </td>
                        {canManage && (
                          <td>
                            {m.id !== profile?.id && (
                              <select
                                value={m.role}
                                onChange={e => changeRole(m.id, e.target.value)}
                                style={{ width:'auto', fontSize:'.75rem', padding:'.25rem .5rem', borderRadius:'var(--r-sm)' }}>
                                {userRole === 'admin' && <option value="admin">Administrador</option>}
                                <option value="manager">Gerente</option>
                                <option value="consultant">Consultor</option>
                                <option value="customer">Cliente</option>
                              </select>
                            )}
                          </td>
                        )}
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
