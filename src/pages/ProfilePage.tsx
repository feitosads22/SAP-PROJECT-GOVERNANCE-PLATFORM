import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador', manager: 'Gerente de Projetos',
  consultant: 'Consultor', customer: 'Cliente',
}

export default function ProfilePage() {
  const { profile, session } = useAuth()
  const [fullName,  setFullName]  = useState(profile?.full_name ?? '')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [erro,      setErro]      = useState<string | null>(null)
  const [,          setPwdOld]    = useState('')
  const [pwdNew,    setPwdNew]    = useState('')
  const [pwdConf,   setPwdConf]   = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg,    setPwdMsg]    = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name)
  }, [profile])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErro(null); setSaved(false)
    const { error } = await sb.from('profiles').update({ full_name: fullName.trim() }).eq('id', profile?.id)
    if (error) setErro(error.message)
    else setSaved(true)
    setSaving(false)
    if (!error) setTimeout(() => setSaved(false), 3000)
  }

  async function handleChangePwd(e: React.FormEvent) {
    e.preventDefault()
    if (pwdNew !== pwdConf) { setPwdMsg('❌ As senhas não coincidem.'); return }
    if (pwdNew.length < 6)  { setPwdMsg('❌ A nova senha deve ter ao menos 6 caracteres.'); return }
    setPwdSaving(true); setPwdMsg(null)
    const { error } = await supabase.auth.updateUser({ password: pwdNew })
    if (error) setPwdMsg(`❌ ${error.message}`)
    else { setPwdMsg('✅ Senha alterada com sucesso!'); setPwdOld(''); setPwdNew(''); setPwdConf('') }
    setPwdSaving(false)
  }

  const initials = (profile?.full_name ?? profile?.email ?? '?')
    .split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">Conta</div>
          <h1>Meu Perfil</h1>
        </div>
      </div>

      {/* Avatar e info */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card__body">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, flexShrink: 0 }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '.25rem' }}>
                {profile?.full_name ?? '—'}
              </div>
              <div style={{ fontSize: '.875rem', color: 'var(--subtle)', marginBottom: '.375rem' }}>
                {session?.user.email}
              </div>
              <span className="badge badge--brand">
                {ROLE_LABEL[profile?.role ?? ''] ?? profile?.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Editar nome */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card__header">
          <span className="card__title">Informações pessoais</span>
        </div>
        <div className="card__body">
          <form onSubmit={handleSaveProfile}>
            <div className="form-group">
              <label>Nome completo</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>E-mail</label>
              <input value={session?.user.email ?? ''} disabled style={{ background: 'var(--surface-2)', color: 'var(--subtle)' }} />
            </div>
            <div className="form-group">
              <label>Perfil de acesso</label>
              <input value={ROLE_LABEL[profile?.role ?? ''] ?? profile?.role ?? ''} disabled style={{ background: 'var(--surface-2)', color: 'var(--subtle)' }} />
            </div>
            {erro && <p className="erro" style={{ marginBottom: '.75rem' }}>{erro}</p>}
            {saved && <p style={{ color: 'var(--ok)', fontSize: '.875rem', marginBottom: '.75rem' }}>✅ Salvo com sucesso!</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button>
            </div>
          </form>
        </div>
      </div>

      {/* Alterar senha */}
      <div className="card">
        <div className="card__header">
          <span className="card__title">🔒 Alterar senha</span>
        </div>
        <div className="card__body">
          <form onSubmit={handleChangePwd}>
            <div className="form-group">
              <label>Nova senha</label>
              <input type="password" value={pwdNew} onChange={e => setPwdNew(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="form-group">
              <label>Confirmar nova senha</label>
              <input type="password" value={pwdConf} onChange={e => setPwdConf(e.target.value)} required placeholder="Repita a nova senha" />
            </div>
            {pwdMsg && (
              <p style={{ fontSize: '.875rem', marginBottom: '.75rem', color: pwdMsg.startsWith('✅') ? 'var(--ok)' : 'var(--danger)' }}>
                {pwdMsg}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={pwdSaving}>{pwdSaving ? 'Alterando…' : 'Alterar senha'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
