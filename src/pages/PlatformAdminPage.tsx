import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getOrganizations, getAllProjectsOrgIds, getAllProfilesOrgIds, createOrganization } from '../lib/platformAdmin'
import type { OrganizationRow } from '../lib/platformAdmin'
import { toast } from '../components/Toast'

export default function PlatformAdminPage() {
  const { signOut } = useAuth()
  const [orgs, setOrgs] = useState<OrganizationRow[]>([])
  const [projCounts, setProjCounts] = useState<Record<string, number>>({})
  const [userCounts, setUserCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [sapClient, setSapClient] = useState('')
  // convidar admin para uma organização específica
  const [invitingOrg, setInvitingOrg] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName,  setInviteName]  = useState('')
  const [inviting,    setInviting]    = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: o }, { data: p }, { data: pr }] = await Promise.all([
      getOrganizations(), getAllProjectsOrgIds(), getAllProfilesOrgIds(),
    ])
    setOrgs((o ?? []) as OrganizationRow[])
    const pc: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(p ?? []).forEach((row: any) => { pc[row.organization_id] = (pc[row.organization_id] ?? 0) + 1 })
    setProjCounts(pc)
    const uc: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(pr ?? []).forEach((row: any) => { if (row.organization_id) uc[row.organization_id] = (uc[row.organization_id] ?? 0) + 1 })
    setUserCounts(uc)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    setSaving(true)
    const { error } = await createOrganization({
      name: name.trim(), slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
      sap_client_number: sapClient.trim() || null,
    })
    if (error) toast(error.message, 'error')
    else { toast('Organização criada!', 'ok'); setName(''); setSlug(''); setSapClient(''); setShowForm(false); void load() }
    setSaving(false)
  }

  async function handleInviteAdmin(e: React.FormEvent, orgId: string) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { error } = await supabase.functions.invoke('invite-user', {
        body: { email: inviteEmail.trim().toLowerCase(), full_name: inviteName.trim() || null, role: 'admin', organization_id: orgId },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      })
      if (error) throw error
      toast('Convite enviado!', 'ok')
      setInvitingOrg(null); setInviteEmail(''); setInviteName('')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao convidar.', 'error')
    } finally {
      setInviting(false)
    }
  }

  const totalProjects = Object.values(projCounts).reduce((s, n) => s + n, 0)
  const totalUsers = Object.values(userCounts).reduce((s, n) => s + n, 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--brand-dark)', color: '#fff', padding: '1rem 1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '.6875rem', fontWeight: 600, opacity: .6, textTransform: 'uppercase', letterSpacing: '.1em' }}>SaaS · Admin Sistema</div>
          <div style={{ fontSize: '1.125rem', fontWeight: 800 }}>Painel do Delivery Manager</div>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => void signOut()}>🚪 Sair</button>
      </header>

      <div className="page" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
          {[
            { icon: '🏢', cls: 'brand', label: 'Organizações (clientes)', val: orgs.length },
            { icon: '📁', cls: 'ok',    label: 'Projetos (todas as orgs)', val: totalProjects },
            { icon: '👥', cls: 'info',  label: 'Usuários (todas as orgs)', val: totalUsers },
          ].map(k => (
            <div key={k.label} className="kpi-card">
              <div className="kpi-card__top">
                <div>
                  <div className="kpi-card__label">{k.label}</div>
                  <div className="kpi-card__value">{loading ? '…' : k.val}</div>
                </div>
                <div className={`kpi-card__icon kpi-card__icon--${k.cls}`}>{k.icon}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="page-header">
          <h1 style={{ fontSize: '1.25rem' }}>Organizações / Clientes</h1>
          <button onClick={() => setShowForm(v => !v)}>{showForm ? '✕ Cancelar' : '+ Nova organização'}</button>
        </div>

        {showForm && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="card__header"><span className="card__title">Cadastrar cliente novo</span></div>
            <div className="card__body">
              <form onSubmit={handleCreate}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Nome do cliente *</label>
                    <input value={name} onChange={e => setName(e.target.value)} required autoFocus placeholder="Ex: Acme Indústria S.A." />
                  </div>
                  <div className="form-group">
                    <label>Slug (identificador único) *</label>
                    <input value={slug} onChange={e => setSlug(e.target.value)} required placeholder="acme-industria" />
                  </div>
                  <div className="form-group">
                    <label>Nº cliente SAP (opcional)</label>
                    <input value={sapClient} onChange={e => setSapClient(e.target.value)} placeholder="Ex: 300" />
                  </div>
                </div>
                <p style={{ fontSize: '.8125rem', color: 'var(--subtle)', marginBottom: '.75rem' }}>
                  Depois de criada, use "Convidar admin" na linha da organização para enviar o primeiro
                  acesso (por e-mail) a essa organização.
                </p>
                <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button type="submit" disabled={saving}>{saving ? 'Criando…' : '✓ Criar organização'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {[1, 2, 3].map(i => <div key={i} style={{ height: 56, borderRadius: 'var(--r)' }} className="skeleton" />)}
          </div>
        ) : orgs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏢</div>
            <div className="empty-state__title">Nenhuma organização cadastrada</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Cliente</th><th>Slug</th><th>Nº SAP</th><th>Projetos</th><th>Usuários</th><th>Criada em</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {orgs.map(o => (
                  <>
                    <tr key={o.id}>
                      <td style={{ fontWeight: 600 }}>{o.name}</td>
                      <td><span className="badge">{o.slug}</span></td>
                      <td>{o.sap_client_number ?? '—'}</td>
                      <td>{projCounts[o.id] ?? 0}</td>
                      <td>{userCounts[o.id] ?? 0}</td>
                      <td style={{ fontSize: '.8125rem', color: 'var(--subtle)' }}>{new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <button className="btn-ghost btn-sm" onClick={() => { setInvitingOrg(invitingOrg === o.id ? null : o.id); setInviteEmail(''); setInviteName('') }}>
                          {invitingOrg === o.id ? '✕ Cancelar' : '+ Convidar admin'}
                        </button>
                      </td>
                    </tr>
                    {invitingOrg === o.id && (
                      <tr key={`${o.id}-invite`}>
                        <td colSpan={7} style={{ background: 'var(--surface-2)', padding: '.75rem 1rem' }}>
                          <form onSubmit={e => handleInviteAdmin(e, o.id)} style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required autoFocus
                              placeholder="e-mail do admin" style={{ fontSize: '.8125rem', flex: '1 1 200px' }} />
                            <input value={inviteName} onChange={e => setInviteName(e.target.value)}
                              placeholder="Nome completo (opcional)" style={{ fontSize: '.8125rem', flex: '1 1 200px' }} />
                            <button type="submit" className="btn-sm" disabled={inviting}>{inviting ? 'Enviando…' : '✓ Enviar convite'}</button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
