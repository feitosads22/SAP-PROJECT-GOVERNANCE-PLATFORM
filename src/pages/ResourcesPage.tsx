import { useEffect, useState } from 'react'
import {
  getResources, createResource, getCapacity,
  getAllocations, createAllocation, deleteAllocation, getAllocatableProfiles,
} from '../lib/resources'
import type { Resource, ResourceAllocation, CapacityRow } from '../lib/resources'
import { getProjects } from '../lib/api'
import { toast } from '../components/Toast'
import { useAuth } from '../contexts/AuthContext'
import type { Project } from '../types/app.types'

type ProfileMini = { id: string; full_name: string | null; email: string | null; role?: string }
type ResourceRow = Resource & { profile: ProfileMini | null }
type AllocationRow = ResourceAllocation & {
  resource: { id: string; profile: ProfileMini | null } | null
  project: { id: string; name: string; code: string } | null
}

const SENIORITY_LABEL: Record<string, string> = {
  junior: 'Júnior', pleno: 'Pleno', senior: 'Sênior', especialista: 'Especialista',
}
const SENIORITY_COLOR: Record<string, string> = {
  junior: '#94A3B8', pleno: '#3B82F6', senior: '#8B5CF6', especialista: '#F59E0B',
}

function extractError(err: unknown): string {
  if (!err) return 'Erro desconhecido.'
  if (typeof err === 'string') return err
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e['message'] === 'string') return e['message']
  }
  return 'Erro desconhecido.'
}

type Props = { role: string }

export default function ResourcesPage({ role }: Props) {
  const { profile } = useAuth()
  const [resources,   setResources]   = useState<ResourceRow[]>([])
  const [capacity,    setCapacity]    = useState<CapacityRow[]>([])
  const [allocations, setAllocations] = useState<AllocationRow[]>([])
  const [projects,    setProjects]    = useState<Project[]>([])
  const [availableProfiles, setAvailableProfiles] = useState<ProfileMini[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [erro,     setErro]     = useState<string | null>(null)
  const [allocatingFor, setAllocatingFor] = useState<string | null>(null)
  const [aSaving,  setASaving]  = useState(false)

  // Form — novo recurso
  const [fProfileId, setFProfileId] = useState('')
  const [fSeniority, setFSeniority] = useState('pleno')
  const [fModules,   setFModules]   = useState('')
  const [fHours,     setFHours]     = useState('40')
  const [fRate,      setFRate]      = useState('')

  // Form — alocar a projeto
  const [aProject, setAProject] = useState('')
  const [aRole,    setARole]    = useState('')
  const [aHours,   setAHours]   = useState('160')
  const [aStart,   setAStart]   = useState(new Date().toISOString().slice(0, 10))
  const [aEnd,     setAEnd]     = useState('')

  const canEdit = ['admin', 'manager'].includes(role)

  async function load() {
    setLoading(true)
    const [rR, rC, rA, rP] = await Promise.all([
      getResources(), getCapacity(), getAllocations(), getProjects(),
    ])
    if (!rR.error) setResources((rR.data ?? []) as ResourceRow[])
    if (!rC.error) setCapacity((rC.data ?? []) as CapacityRow[])
    if (!rA.error) setAllocations((rA.data ?? []) as AllocationRow[])
    if (!rP.error) setProjects(rP.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  function toggleForm() {
    setShowForm(v => {
      const next = !v
      if (next) {
        void getAllocatableProfiles().then(({ data, error }) => {
          if (error) toast(extractError(error), 'error')
          else setAvailableProfiles((data ?? []) as ProfileMini[])
        })
      }
      return next
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!fProfileId) return
    setSaving(true); setErro(null)
    const { error } = await createResource({
      organization_id: profile?.organization_id ?? undefined,
      profile_id: fProfileId,
      seniority: fSeniority,
      sap_modules: fModules.split(',').map(s => s.trim()).filter(Boolean),
      hourly_rate: fRate ? parseFloat(fRate) : null,
      weekly_capacity_hours: parseFloat(fHours) || 40,
    })
    if (error) { setErro(extractError(error)); setSaving(false); return }
    toast('Recurso cadastrado!', 'ok')
    setFProfileId(''); setFSeniority('pleno'); setFModules(''); setFHours('40'); setFRate('')
    setShowForm(false); void load()
    setSaving(false)
  }

  function openAllocate(resourceId: string) {
    setAllocatingFor(v => v === resourceId ? null : resourceId)
    setAProject(''); setARole(''); setAHours('160')
    setAStart(new Date().toISOString().slice(0, 10)); setAEnd('')
  }

  async function handleAllocate(e: React.FormEvent, resourceId: string) {
    e.preventDefault()
    if (!aProject || !aHours) return
    setASaving(true)
    const { error } = await createAllocation({
      organization_id: profile?.organization_id ?? undefined,
      resource_id: resourceId,
      project_id: aProject,
      role_in_project: aRole.trim() || null,
      allocated_hours: parseFloat(aHours),
      start_date: aStart || null,
      end_date: aEnd || null,
    })
    if (error) toast(extractError(error), 'error')
    else { toast('Recurso alocado ao projeto!', 'ok'); setAllocatingFor(null); void load() }
    setASaving(false)
  }

  async function handleEndAllocation(id: string) {
    if (!confirm('Encerrar esta alocação?')) return
    const { error } = await deleteAllocation(id)
    if (error) toast(extractError(error), 'error')
    else { toast('Alocação encerrada.', 'warn'); void load() }
  }

  const filtered = resources.filter(r => {
    const name = (r.profile?.full_name ?? r.profile?.email ?? '').toLowerCase()
    return !search || name.includes(search.toLowerCase())
  })

  const capByResource = Object.fromEntries(capacity.map(c => [c.resource_id, c]))
  const allocsByResource: Record<string, AllocationRow[]> = {}
  allocations.forEach(a => {
    if (!a.resource_id) return
    if (!allocsByResource[a.resource_id]) allocsByResource[a.resource_id] = []
    allocsByResource[a.resource_id].push(a)
  })
  const today = new Date().toISOString().slice(0, 10)
  const isActiveAlloc = (a: AllocationRow) =>
    (!a.start_date || a.start_date <= today) && (!a.end_date || a.end_date >= today)

  // KPIs — a partir da view resource_capacity (mesma fonte da tela de Capacidade)
  const activeResources = resources.filter(r => r.is_active).length
  const totalCapacity   = capacity.reduce((s, c) => s + c.weekly_capacity_hours, 0)
  const totalAllocated  = capacity.reduce((s, c) => s + c.total_allocated_hours, 0)
  const avgUtil         = capacity.length
    ? Math.round(capacity.reduce((s, c) => s + c.utilization_pct, 0) / capacity.length) : 0
  const overloaded      = capacity.filter(c => c.capacity_status === 'overload').length

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">Execução</div>
          <h1>Gestão de Recursos</h1>
          <p className="page-header__sub">Capacidade, alocação e horas da equipe</p>
        </div>
        {canEdit && (
          <div className="page-header__actions">
            <button onClick={toggleForm}>
              {showForm ? '✕ Cancelar' : '+ Novo recurso'}
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { icon: '👥', cls: 'brand', label: 'Recursos ativos',        val: activeResources },
          { icon: '⏱',  cls: 'info',  label: 'Capacidade total/semana', val: `${totalCapacity}h` },
          { icon: '📊', cls: 'ok',    label: 'Horas alocadas',          val: `${totalAllocated}h` },
          { icon: '📈', cls: avgUtil > 90 ? 'danger' : avgUtil > 70 ? 'warn' : 'ok',
            label: 'Utilização média (semana)', val: `${avgUtil}%` },
          { icon: '⚠️', cls: 'danger', label: 'Sobrecarregados',        val: overloaded },
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

      {/* Form — novo recurso */}
      {showForm && canEdit && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card__header">
            <span className="card__title">Cadastrar recurso</span>
          </div>
          <div className="card__body">
            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Pessoa *</label>
                  <select value={fProfileId} onChange={e => setFProfileId(e.target.value)} required>
                    <option value="">— Selecione —</option>
                    {availableProfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name ?? p.email} {p.role ? `(${p.role})` : ''}</option>
                    ))}
                  </select>
                  {availableProfiles.length === 0 && (
                    <p style={{ fontSize: '.75rem', color: 'var(--subtle)', marginTop: '.25rem' }}>
                      Todos os perfis elegíveis já têm um recurso cadastrado.
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label>Senioridade</label>
                  <select value={fSeniority} onChange={e => setFSeniority(e.target.value)}>
                    {Object.entries(SENIORITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Módulos SAP</label>
                  <input value={fModules} onChange={e => setFModules(e.target.value)} placeholder="FI, MM, SD (separados por vírgula)" />
                </div>
                <div className="form-group">
                  <label>Capacidade (h/semana)</label>
                  <input type="number" value={fHours} onChange={e => setFHours(e.target.value)} min={1} max={168} />
                </div>
                <div className="form-group">
                  <label>Taxa horária (R$)</label>
                  <input type="number" value={fRate} onChange={e => setFRate(e.target.value)} min={0} step={0.01} placeholder="Opcional" />
                </div>
              </div>
              {erro && <p className="erro" style={{ marginBottom: '.75rem' }}>{erro}</p>}
              <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" disabled={saving || !fProfileId}>{saving ? 'Salvando…' : '✓ Cadastrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="filter-bar">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar recurso…" style={{ flex: 1 }} />
        {search && <button className="btn-ghost btn-sm" onClick={() => setSearch('')}>Limpar</button>}
      </div>

      {/* Resource cards */}
      {loading ? (
        <div className="cap-grid">
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 220, borderRadius: 'var(--r-lg)' }} className="skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">👥</div>
          <div className="empty-state__title">Nenhum recurso cadastrado</div>
          <p className="empty-state__desc">{canEdit ? 'Clique em "+ Novo recurso" para começar.' : 'Nenhum recurso encontrado.'}</p>
        </div>
      ) : (
        <div className="cap-grid">
          {filtered.map(r => {
            const cap = capByResource[r.id]
            const pct = cap ? Math.min(cap.utilization_pct, 150) : 0
            const statusCls = !cap ? '' : cap.capacity_status === 'overload' ? 'cap--overload' : cap.capacity_status === 'atencao' ? 'cap--atencao' : 'cap--ok'
            const barColor  = pct > 100 ? 'var(--danger)' : pct > 80 ? 'var(--warn)' : 'var(--ok)'
            const active = (allocsByResource[r.id] ?? []).filter(isActiveAlloc)
            const name = r.profile?.full_name ?? r.profile?.email ?? '—'

            return (
              <div key={r.id} className={`cap-card ${statusCls}`}>
                <div className="cap-card__top">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.25rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-light)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '.75rem', flexShrink: 0 }}>
                        {name[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <div className="cap-card__name" style={{ fontSize: '.9375rem' }}>{name}</div>
                        {r.profile?.email && <div style={{ fontSize: '.75rem', color: 'var(--subtle)' }}>{r.profile.email}</div>}
                      </div>
                    </div>
                    <span className="badge" style={{ background: (SENIORITY_COLOR[r.seniority] ?? '#94A3B8') + '22', color: SENIORITY_COLOR[r.seniority] ?? '#94A3B8', fontSize: '.625rem' }}>
                      {SENIORITY_LABEL[r.seniority] ?? r.seniority}
                    </span>
                    {r.sap_modules?.length > 0 && (
                      <span style={{ fontSize: '.6875rem', color: 'var(--subtle)', marginLeft: '.375rem' }}>
                        {r.sap_modules.join(', ')}
                      </span>
                    )}
                  </div>
                  {cap && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: barColor }}>{cap.utilization_pct}%</div>
                      <div style={{ fontSize: '.625rem', color: 'var(--subtle)' }}>utilização/semana</div>
                    </div>
                  )}
                </div>

                {cap && (
                  <div className="cap-bar-wrap">
                    <div className="cap-bar">
                      <div className="cap-bar__fill" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                    <span style={{ fontSize: '.75rem', color: 'var(--subtle)', whiteSpace: 'nowrap' }}>
                      {cap.hours_this_week}h / {cap.weekly_capacity_hours}h
                    </span>
                  </div>
                )}

                {/* Alocações ativas */}
                {active.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.25rem', marginTop: '.25rem' }}>
                    {active.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '.375rem' }}>
                        <span className="badge badge--brand" style={{ fontSize: '.625rem' }}>
                          {a.project?.code ?? '—'} · {a.allocated_hours}h{a.role_in_project ? ` · ${a.role_in_project}` : ''}
                        </span>
                        {canEdit && (
                          <button className="btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: '.625rem', padding: 0 }}
                            onClick={() => handleEndAllocation(a.id)} title="Encerrar alocação">✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '.75rem', color: 'var(--subtle-2)', fontStyle: 'italic', marginTop: '.25rem' }}>Sem alocação ativa</div>
                )}

                {cap && pct > 100 && (
                  <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '.6875rem', fontWeight: 600, padding: '.25rem .5rem', borderRadius: 'var(--r-sm)', marginTop: '.25rem' }}>
                    ⚠️ Sobrecarga: {pct - 100}% acima da capacidade
                  </div>
                )}

                {canEdit && (
                  <button className="btn-secondary btn-sm" style={{ marginTop: '.5rem' }} onClick={() => openAllocate(r.id)}>
                    {allocatingFor === r.id ? '✕ Cancelar' : '+ Alocar a projeto'}
                  </button>
                )}

                {allocatingFor === r.id && (
                  <form onSubmit={e => handleAllocate(e, r.id)} style={{ marginTop: '.5rem', display: 'flex', flexDirection: 'column', gap: '.5rem', borderTop: '1px solid var(--border)', paddingTop: '.5rem' }}>
                    <select value={aProject} onChange={e => setAProject(e.target.value)} required style={{ fontSize: '.8125rem' }}>
                      <option value="">— Projeto —</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: '.375rem' }}>
                      <input value={aRole} onChange={e => setARole(e.target.value)} placeholder="Papel (opcional)" style={{ flex: 1, fontSize: '.8125rem' }} />
                      <input type="number" value={aHours} onChange={e => setAHours(e.target.value)} min={1} placeholder="Horas" style={{ width: 90, fontSize: '.8125rem' }} required />
                    </div>
                    <div style={{ display: 'flex', gap: '.375rem' }}>
                      <input type="date" value={aStart} onChange={e => setAStart(e.target.value)} style={{ flex: 1, fontSize: '.8125rem' }} />
                      <input type="date" value={aEnd} onChange={e => setAEnd(e.target.value)} placeholder="Fim (opcional)" style={{ flex: 1, fontSize: '.8125rem' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn-sm" disabled={aSaving}>{aSaving ? 'Alocando…' : '✓ Confirmar'}</button>
                    </div>
                  </form>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
