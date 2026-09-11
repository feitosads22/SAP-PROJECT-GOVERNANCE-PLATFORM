import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Org = {
  id: string; name: string; slug: string | null
  logo_url: string | null; primary_color: string | null
  timezone: string | null; created_at: string
}

type Props = { role: string }

export default function SettingsPage({ role }: Props) {
  const { profile } = useAuth()
  const [org,     setOrg]     = useState<Org | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [erro,    setErro]    = useState<string | null>(null)
  const [name,    setName]    = useState('')
  const [color,   setColor]   = useState('#0A6ED1')
  const [tz,      setTz]      = useState('America/Sao_Paulo')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const canEdit = role === 'admin'

  async function load() {
    setLoading(true)
    const { data, error } = await sb.from('organizations')
      .select('*').eq('id', profile?.organization_id).single()
    if (!error && data) {
      setOrg(data)
      setName(data.name)
      setColor(data.primary_color ?? '#0A6ED1')
      setTz(data.timezone ?? 'America/Sao_Paulo')
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [profile?.organization_id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErro(null); setSaved(false)
    const { error } = await sb.from('organizations')
      .update({ name: name.trim(), primary_color: color, timezone: tz })
      .eq('id', profile?.organization_id)
    if (error) setErro(error.message)
    else setSaved(true)
    setSaving(false)
    if (!error) setTimeout(() => setSaved(false), 3000)
  }

  const TIMEZONES = [
    'America/Sao_Paulo', 'America/Manaus', 'America/Belem',
    'America/Recife', 'America/Fortaleza', 'America/Porto_Velho',
    'America/Boa_Vista', 'America/Cuiaba', 'America/Campo_Grande',
  ]

  if (loading) return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div style={{ height: 200, borderRadius: 'var(--r-lg)' }} className="skeleton" />
    </div>
  )

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">Sistema</div>
          <h1>Configurações</h1>
          <p className="page-header__sub">Configurações da organização</p>
        </div>
      </div>

      {/* Org info */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card__header">
          <span className="card__title">🏢 Organização</span>
          {!canEdit && <span className="badge">Somente leitura</span>}
        </div>
        <div className="card__body">
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Nome da organização</label>
              <input value={name} onChange={e => setName(e.target.value)}
                disabled={!canEdit} required
                style={!canEdit ? { background: 'var(--surface-2)', color: 'var(--subtle)' } : {}} />
            </div>

            <div className="form-group">
              <label>ID da organização</label>
              <input value={org?.id ?? ''} disabled
                style={{ background: 'var(--surface-2)', color: 'var(--subtle)', fontFamily: 'monospace', fontSize: '.8125rem' }} />
            </div>

            <div className="form-group">
              <label>Fuso horário</label>
              <select value={tz} onChange={e => setTz(e.target.value)} disabled={!canEdit}
                style={!canEdit ? { background: 'var(--surface-2)', color: 'var(--subtle)' } : {}}>
                {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Cor principal</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  disabled={!canEdit}
                  style={{ width: 48, height: 36, padding: 2, borderRadius: 'var(--r)', border: '1.5px solid var(--border)', cursor: canEdit ? 'pointer' : 'not-allowed' }} />
                <input value={color} onChange={e => setColor(e.target.value)}
                  disabled={!canEdit} placeholder="#0A6ED1"
                  style={{ flex: 1, fontFamily: 'monospace', ...(canEdit ? {} : { background: 'var(--surface-2)', color: 'var(--subtle)' }) }} />
                <div style={{ width: 36, height: 36, borderRadius: 'var(--r)', background: color, border: '1px solid var(--border)' }} />
              </div>
            </div>

            <div className="form-group">
              <label>Criada em</label>
              <input value={org?.created_at ? new Date(org.created_at).toLocaleDateString('pt-BR') : ''} disabled
                style={{ background: 'var(--surface-2)', color: 'var(--subtle)' }} />
            </div>

            {canEdit && (
              <>
                {erro && <p className="erro" style={{ marginBottom: '.75rem' }}>{erro}</p>}
                {saved && <p style={{ color: 'var(--ok)', fontSize: '.875rem', marginBottom: '.75rem' }}>✅ Configurações salvas!</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar configurações'}</button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>

      {/* System info */}
      <div className="card">
        <div className="card__header">
          <span className="card__title">ℹ️ Sobre o sistema</span>
        </div>
        <div className="card__body">
          {[
            { label: 'Plataforma',  val: 'SAP Governance Platform' },
            { label: 'Versão',      val: 'Fase 9 — Build 2026.09' },
            { label: 'Stack',       val: 'React + TypeScript + Supabase + Vercel' },
            { label: 'Suporte',     val: 'System_2F' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '.875rem', color: 'var(--subtle)' }}>{r.label}</span>
              <span style={{ fontSize: '.875rem', fontWeight: 600 }}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
