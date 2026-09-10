import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getProjects } from '../lib/api'
import type { Project } from '../types/app.types'

type Resource = {
  id: string; name: string; email: string | null; role: string | null
  seniority: string | null; hourly_rate: number | null
  monthly_hours_available: number; is_active: boolean
}
type Allocation = {
  id: string; resource_id: string; project_id: string
  start_date: string; end_date: string | null
  allocated_hours_month: number; role_in_project: string | null
}

const SENIORITY_LABEL: Record<string, string> = {
  junior: 'Júnior', pleno: 'Pleno', senior: 'Sênior', especialista: 'Especialista',
}
const SENIORITY_COLOR: Record<string, string> = {
  junior: '#94A3B8', pleno: '#3B82F6', senior: '#8B5CF6', especialista: '#F59E0B',
}

type Props = { role: string }

export default function ResourcesPage({ role }: Props) {
  const [resources,    setResources]    = useState<Resource[]>([])
  const [allocations,  setAllocations]  = useState<Allocation[]>([])
  const [projects,     setProjects]     = useState<Project[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [showForm,     setShowForm]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [erro,         setErro]         = useState<string | null>(null)

  // Form
  const [fName,     setFName]     = useState('')
  const [fEmail,    setFEmail]    = useState('')
  const [fRole,     setFRole]     = useState('')
  const [fSeniority,setFSeniority]= useState('pleno')
  const [fHours,    setFHours]    = useState('160')
  const [fRate,     setFRate]     = useState('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const canEdit = ['admin', 'manager'].includes(role)

  async function load() {
    setLoading(true)
    const [rR, rA, rP] = await Promise.all([
      sb.from('resources').select('*').order('name'),
      sb.from('resource_allocations').select('*'),
      getProjects(),
    ])
    if (!rR.error) setResources(rR.data ?? [])
    if (!rA.error) setAllocations(rA.data ?? [])
    if (!rP.error) setProjects(rP.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!fName.trim()) return
    setSaving(true); setErro(null)
    const { error } = await sb.from('resources').insert({
      name: fName.trim(),
      email: fEmail.trim() || null,
      role: fRole.trim() || null,
      seniority: fSeniority,
      monthly_hours_available: parseInt(fHours) || 160,
      hourly_rate: fRate ? parseFloat(fRate) : null,
      is_active: true,
    })
    if (error) { setErro(error.message); setSaving(false); return }
    setFName(''); setFEmail(''); setFRole(''); setFSeniority('pleno'); setFHours('160'); setFRate('')
    setShowForm(false); void load()
    setSaving(false)
  }

  const filtered = resources.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.role ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const projMap = Object.fromEntries(projects.map(p => [p.id, p]))

  function utilization(resource: Resource) {
    const month = new Date().getMonth()
    const year  = new Date().getFullYear()
    const active = allocations.filter(a => {
      if (a.resource_id !== resource.id) return false
      const start = new Date(a.start_date)
      const end   = a.end_date ? new Date(a.end_date) : new Date(year + 1, 0, 1)
      return start.getMonth() <= month && start.getFullYear() <= year &&
             end.getMonth() >= month && end.getFullYear() >= year
    })
    const totalAllocated = active.reduce((s, a) => s + a.allocated_hours_month, 0)
    const pct = resource.monthly_hours_available > 0
      ? Math.round(totalAllocated / resource.monthly_hours_available * 100)
      : 0
    return { totalAllocated, pct, active }
  }

  // KPIs
  const activeResources  = resources.filter(r => r.is_active).length
  const totalCapacity    = resources.filter(r => r.is_active).reduce((s, r) => s + r.monthly_hours_available, 0)
  const totalAllocated   = resources.filter(r => r.is_active).reduce((s, r) => s + utilization(r).totalAllocated, 0)
  const avgUtil          = totalCapacity > 0 ? Math.round(totalAllocated / totalCapacity * 100) : 0
  const overloaded       = resources.filter(r => r.is_active && utilization(r).pct > 100).length

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">Execução</div>
          <h1>Gestão de Recursos</h1>
          <p className="page-header__sub">Capacidade e alocação da equipe</p>
        </div>
        {canEdit && (
          <div className="page-header__actions">
            <button onClick={() => setShowForm(v => !v)}>
              {showForm ? '✕ Cancelar' : '+ Novo recurso'}
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { icon: '👥', cls: 'brand',  label: 'Recursos ativos',    val: activeResources },
          { icon: '⏱',  cls: 'info',   label: 'Capacidade total/mês',val: `${totalCapacity}h` },
          { icon: '📊', cls: 'ok',     label: 'Horas alocadas/mês',  val: `${totalAllocated}h` },
          { icon: '📈', cls: avgUtil > 90 ? 'danger' : avgUtil > 70 ? 'warn' : 'ok',
            label: 'Utilização média', val: `${avgUtil}%` },
          { icon: '⚠️', cls: 'danger', label: 'Sobrecarregados',     val: overloaded },
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

      {/* Form */}
      {showForm && canEdit && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card__header">
            <span className="card__title">Cadastrar recurso</span>
          </div>
          <div className="card__body">
            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nome *</label>
                  <input value={fName} onChange={e => setFName(e.target.value)} required autoFocus placeholder="Nome completo" />
                </div>
                <div className="form-group">
                  <label>E-mail</label>
                  <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="email@empresa.com" />
                </div>
                <div className="form-group">
                  <label>Função / Especialidade</label>
                  <input value={fRole} onChange={e => setFRole(e.target.value)} placeholder="Ex: Consultor FI, Desenvolvedor ABAP" />
                </div>
                <div className="form-group">
                  <label>Senioridade</label>
                  <select value={fSeniority} onChange={e => setFSeniority(e.target.value)}>
                    {Object.entries(SENIORITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Horas disponíveis/mês</label>
                  <input type="number" value={fHours} onChange={e => setFHours(e.target.value)} min={0} max={300} />
                </div>
                <div className="form-group">
                  <label>Taxa horária (R$)</label>
                  <input type="number" value={fRate} onChange={e => setFRate(e.target.value)} min={0} step={0.01} placeholder="Opcional" />
                </div>
              </div>
              {erro && <p className="erro" style={{ marginBottom: '.75rem' }}>{erro}</p>}
              <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" disabled={saving}>{saving ? 'Salvando…' : '✓ Cadastrar'}</button>
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
          {[1,2,3,4].map(i => <div key={i} style={{ height: 160, borderRadius: 'var(--r-lg)' }} className="skeleton" />)}
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
            const { totalAllocated: alloc, pct, active: activeAllocs } = utilization(r)
            const statusCls = pct > 100 ? 'cap--overload' : pct > 80 ? 'cap--atencao' : 'cap--ok'
            const barColor  = pct > 100 ? 'var(--danger)' : pct > 80 ? 'var(--warn)' : 'var(--ok)'
            return (
              <div key={r.id} className={`cap-card ${statusCls}`}>
                <div className="cap-card__top">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.25rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-light)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '.75rem' }}>
                        {r.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="cap-card__name" style={{ fontSize: '.9375rem' }}>{r.name}</div>
                        {r.role && <div style={{ fontSize: '.75rem', color: 'var(--subtle)' }}>{r.role}</div>}
                      </div>
                    </div>
                    {r.seniority && (
                      <span className="badge" style={{ background: (SENIORITY_COLOR[r.seniority] ?? '#94A3B8') + '22', color: SENIORITY_COLOR[r.seniority] ?? '#94A3B8', fontSize: '.625rem' }}>
                        {SENIORITY_LABEL[r.seniority] ?? r.seniority}
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: barColor }}>{pct}%</div>
                    <div style={{ fontSize: '.625rem', color: 'var(--subtle)' }}>utilização</div>
                  </div>
                </div>

                {/* Utilization bar */}
                <div className="cap-bar-wrap">
                  <div className="cap-bar">
                    <div className="cap-bar__fill" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                  </div>
                  <span style={{ fontSize: '.75rem', color: 'var(--subtle)', whiteSpace: 'nowrap' }}>
                    {alloc}h / {r.monthly_hours_available}h
                  </span>
                </div>

                {/* Active project allocations */}
                {activeAllocs.length > 0 && (
                  <div style={{ display: 'flex', gap: '.25rem', flexWrap: 'wrap', marginTop: '.25rem' }}>
                    {activeAllocs.map(a => (
                      <span key={a.id} className="badge badge--brand" style={{ fontSize: '.625rem' }}>
                        {projMap[a.project_id]?.code ?? '—'} ({a.allocated_hours_month}h)
                      </span>
                    ))}
                  </div>
                )}

                {activeAllocs.length === 0 && (
                  <div style={{ fontSize: '.75rem', color: 'var(--subtle-2)', fontStyle: 'italic' }}>Sem alocação ativa</div>
                )}

                {pct > 100 && (
                  <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '.6875rem', fontWeight: 600, padding: '.25rem .5rem', borderRadius: 'var(--r-sm)', marginTop: '.25rem' }}>
                    ⚠️ Sobrecarga: {pct - 100}% acima da capacidade
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
