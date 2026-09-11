import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getOrgProfiles } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { toast } from './Toast'

type MemberProfile = { id: string; full_name: string | null; email: string | null }
type Member = { id: string; user_id: string; role: string; profile: MemberProfile | null }
type ResourceMini = { id: string; profile_id: string; seniority: string; weekly_capacity_hours: number }
type AllocMini = { id: string; resource_id: string; project_id: string; allocated_hours: number; project: { id: string; code: string; name: string } | null }

const ROLE_LABEL: Record<string, string> = { manager: 'Gerente', consultant: 'Consultor', viewer: 'Visualizador' }
const ROLE_COLOR: Record<string, string> = { manager: '#0A6ED1', consultant: '#16A34A', viewer: '#94A3B8' }

type Props = { projectId: string; canManage: boolean }

export default function ProjectTeamTab({ projectId, canManage }: Props) {
  const { profile } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [resourcesByProfile, setResourcesByProfile] = useState<Record<string, ResourceMini>>({})
  const [allocations, setAllocations] = useState<AllocMini[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [orgProfiles, setOrgProfiles] = useState<MemberProfile[]>([])
  const [newUser, setNewUser] = useState('')
  const [newRole, setNewRole] = useState('consultant')
  const [saving, setSaving] = useState(false)
  // edição de % dedicado
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editPct, setEditPct] = useState('')
  const [savingPct, setSavingPct] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  async function load() {
    setLoading(true)
    const { data: pm, error: pmErr } = await sb.from('project_members')
      .select('id, user_id, role, profile:profiles!project_members_user_id_fkey(id, full_name, email)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (pmErr) toast(pmErr.message, 'error')
    const mem = (pm ?? []) as Member[]
    setMembers(mem)

    const profileIds = mem.map(m => m.user_id)
    if (profileIds.length === 0) { setResourcesByProfile({}); setAllocations([]); setLoading(false); return }

    const { data: res } = await sb.from('resources').select('id, profile_id, seniority, weekly_capacity_hours').in('profile_id', profileIds)
    const byProfile: Record<string, ResourceMini> = {}
    ;(res ?? []).forEach((r: ResourceMini) => { byProfile[r.profile_id] = r })
    setResourcesByProfile(byProfile)

    const resourceIds = (res ?? []).map((r: ResourceMini) => r.id)
    if (resourceIds.length === 0) { setAllocations([]); setLoading(false); return }

    const { data: allocs } = await sb.from('resource_allocations')
      .select('id, resource_id, project_id, allocated_hours, project:projects(id, code, name)')
      .in('resource_id', resourceIds)
    setAllocations((allocs ?? []) as AllocMini[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [projectId])

  async function openForm() {
    setShowForm(v => {
      const next = !v
      if (next) void getOrgProfiles().then(({ data }) => setOrgProfiles((data ?? []) as MemberProfile[]))
      return next
    })
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newUser) return
    setSaving(true)
    const { error } = await sb.from('project_members').upsert(
      { project_id: projectId, user_id: newUser, role: newRole },
      { onConflict: 'project_id,user_id' },
    )
    if (error) toast(error.message, 'error')
    else { toast('Membro adicionado!', 'ok'); setShowForm(false); setNewUser(''); setNewRole('consultant'); void load() }
    setSaving(false)
  }

  function startEditPct(userId: string, currentPct: number | null) {
    setEditingUser(userId)
    setEditPct(currentPct != null ? String(currentPct) : '')
  }

  async function savePct(resource: ResourceMini, existingAllocId: string | undefined) {
    const pct = Math.max(0, Math.min(100, Number(editPct)))
    if (!editPct || Number.isNaN(pct)) return
    setSavingPct(true)
    const hours = Math.round((pct / 100) * resource.weekly_capacity_hours * 10) / 10
    const { error } = existingAllocId
      ? await sb.from('resource_allocations').update({ allocated_hours: hours }).eq('id', existingAllocId)
      : await sb.from('resource_allocations').insert({
          organization_id: profile?.organization_id,
          resource_id: resource.id, project_id: projectId,
          allocated_hours: hours, start_date: new Date().toISOString().slice(0, 10),
        })
    if (error) toast(error.message, 'error')
    else { toast('% de dedicação atualizado!', 'ok'); setEditingUser(null); void load() }
    setSavingPct(false)
  }

  async function handleRemove(id: string) {
    if (!confirm('Remover este membro do projeto?')) return
    await sb.from('project_members').delete().eq('id', id)
    void load()
  }

  const availableProfiles = orgProfiles.filter(p => !members.some(m => m.user_id === p.id))

  return (
    <div className="card">
      <div className="card__header">
        <span className="card__title"><span className="card__title-icon">👥</span>Equipe do Projeto</span>
        {canManage && (
          <button className="btn-secondary btn-sm" onClick={openForm}>
            {showForm ? '✕ Cancelar' : '+ Adicionar membro'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="card__body" style={{ borderBottom: '1px solid var(--border)' }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={newUser} onChange={e => setNewUser(e.target.value)} required style={{ flex: '1 1 220px' }}>
              <option value="">— Selecione a pessoa —</option>
              {availableProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
            </select>
            <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ flex: '0 1 160px' }}>
              <option value="manager">Gerente</option>
              <option value="consultant">Consultor</option>
              <option value="viewer">Visualizador</option>
            </select>
            <button type="submit" className="btn-sm" disabled={saving || !newUser}>{saving ? 'Adicionando…' : '✓ Adicionar'}</button>
          </form>
        </div>
      )}

      <div className="card__body" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '1rem 1.25rem' }}><p className="sutil">Carregando…</p></div>
        ) : members.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">👥</div>
            <div className="empty-state__title">Ninguém alocado ainda</div>
            <p className="empty-state__desc">{canManage ? 'Clique em "+ Adicionar membro" para montar a equipe.' : 'Nenhum membro alocado.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pessoa</th><th>Papel no projeto</th><th>Senioridade</th>
                  <th>Horas neste projeto</th><th>% dedicado a este projeto</th>
                  <th>Também atua em</th>{canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {members.map(m => {
                  const resource = resourcesByProfile[m.user_id]
                  const myAllocs = resource ? allocations.filter(a => a.resource_id === resource.id) : []
                  const thisAlloc = myAllocs.find(a => a.project_id === projectId)
                  const pct = resource && resource.weekly_capacity_hours > 0
                    ? Math.round((thisAlloc ? Number(thisAlloc.allocated_hours) : 0) / resource.weekly_capacity_hours * 100)
                    : null
                  const totalPctAllProjects = resource && resource.weekly_capacity_hours > 0
                    ? Math.round(myAllocs.reduce((s, a) => s + Number(a.allocated_hours), 0) / resource.weekly_capacity_hours * 100)
                    : null
                  const otherProjects = myAllocs.filter(a => a.project_id !== projectId && a.project)
                  const isEditing = editingUser === m.user_id
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{m.profile?.full_name ?? m.profile?.email ?? '—'}</div>
                        {m.profile?.email && <div style={{ fontSize: '.75rem', color: 'var(--subtle)' }}>{m.profile.email}</div>}
                      </td>
                      <td>
                        <span className="badge" style={{ background: (ROLE_COLOR[m.role] ?? '#94A3B8') + '22', color: ROLE_COLOR[m.role] ?? '#94A3B8', borderColor: (ROLE_COLOR[m.role] ?? '#94A3B8') + '44' }}>
                          {ROLE_LABEL[m.role] ?? m.role}
                        </span>
                      </td>
                      <td style={{ fontSize: '.8125rem' }}>{resource?.seniority ?? '—'}</td>
                      <td style={{ fontWeight: 700 }}>{thisAlloc ? `${thisAlloc.allocated_hours}h` : '—'}</td>
                      <td style={{ minWidth: 170 }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.375rem' }}>
                            <input type="number" min={0} max={100} value={editPct} onChange={e => setEditPct(e.target.value)}
                              autoFocus style={{ width: 64, fontSize: '.8125rem', padding: '.2rem .4rem' }}
                              onKeyDown={e => { if (e.key === 'Enter' && resource) void savePct(resource, thisAlloc?.id); if (e.key === 'Escape') setEditingUser(null) }} />
                            <span style={{ fontSize: '.75rem' }}>%</span>
                            <button className="btn-sm" disabled={savingPct || !resource} onClick={() => resource && savePct(resource, thisAlloc?.id)}>{savingPct ? '…' : '✓'}</button>
                            <button className="btn-ghost btn-sm" onClick={() => setEditingUser(null)}>✕</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.375rem' }}>
                            {pct != null ? (
                              <>
                                <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden', minWidth: 50 }}>
                                  <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: pct >= 70 ? 'var(--ok)' : pct >= 30 ? 'var(--brand)' : 'var(--warn)', borderRadius: 99 }} />
                                </div>
                                <span style={{ fontSize: '.75rem', fontWeight: 700 }}>{pct}%</span>
                              </>
                            ) : <span className="sutil">{resource ? '0%' : '—'}</span>}
                            {canManage && resource && (
                              <button className="btn-ghost btn-sm" style={{ padding: 0, fontSize: '.6875rem' }} title="Editar %"
                                onClick={() => startEditPct(m.user_id, pct)}>✏️</button>
                            )}
                          </div>
                        )}
                        {!isEditing && totalPctAllProjects != null && totalPctAllProjects > 100 && (
                          <div style={{ fontSize: '.625rem', color: 'var(--danger)', fontWeight: 700, marginTop: '.125rem' }}>
                            ⚠️ {totalPctAllProjects}% no total (sobrealocado)
                          </div>
                        )}
                      </td>
                      <td>
                        {otherProjects.length === 0 ? (
                          <span style={{ fontSize: '.75rem', color: 'var(--subtle-2)' }}>Só aqui</span>
                        ) : (
                          <div style={{ display: 'flex', gap: '.25rem', flexWrap: 'wrap' }}>
                            {otherProjects.map(a => (
                              <Link key={a.project_id} to={`/projeto/${a.project_id}`} className="badge badge--brand" style={{ fontSize: '.6875rem', textDecoration: 'none' }}>
                                {a.project?.code}
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>
                      {canManage && (
                        <td>
                          <button className="btn-ghost btn-sm btn-danger" onClick={() => handleRemove(m.id)}>Remover</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && members.length > 0 && (
        <div style={{ padding: '.5rem 1.25rem', fontSize: '.75rem', color: 'var(--subtle)', borderTop: '1px solid var(--border)' }}>
          % = horas alocadas neste projeto ÷ capacidade semanal da pessoa. Clique no ✏️ pra editar direto aqui —
          isso cria/atualiza a alocação em <Link to="/recursos">Gestão de Recursos</Link>. Quem não tem recurso cadastrado
          precisa ser cadastrado lá primeiro.
        </div>
      )}
    </div>
  )
}
