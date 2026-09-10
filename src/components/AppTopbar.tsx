import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

type Props = { onMenuToggle: () => void }

export default function AppTopbar({ onMenuToggle }: Props) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [dropOpen,    setDropOpen]    = useState(false)
  const [notifCount,  setNotifCount]  = useState(0)
  const [search, setSearch]     = useState('')
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profile?.id) return
    const sb = supabase as any
    sb.from('notifications').select('id', { count: 'exact' })
      .eq('user_id', profile.id).eq('read', false)
      .then(({ count }: { count: number }) => setNotifCount(count ?? 0))
  }, [profile?.id])

  const initials = profile?.full_name
    ?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    ?? profile?.email?.[0].toUpperCase()
    ?? '?'

  const roleLabel: Record<string, string> = {
    admin: 'Administrador', manager: 'Gerente de Projetos',
    consultant: 'Consultor', customer: 'Cliente',
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && search.trim()) {
      navigate(`/?q=${encodeURIComponent(search.trim())}`)
    }
  }

  return (
    <header className="topbar">
      <button className="topbar__hamburger" onClick={onMenuToggle}>☰</button>

      <div className="topbar__search">
        <span className="topbar__search-icon">🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleSearch}
          placeholder="Buscar projetos, tarefas, pessoas…"
        />
      </div>

      <div className="topbar__right">
        {profile?.role !== 'customer' && (
          <button className="topbar__btn" onClick={() => navigate('/notificacoes')}
          style={{ position: 'relative' }} title="Notificações">
          🔔
          {notifCount > 0 && (
            <span className="topbar__notif-dot" style={{ width: 'auto', minWidth: 14, height: 14, padding: '0 3px', borderRadius: 7, fontSize: '.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', top: 4, right: 4 }}>
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>
        )}

        <div style={{ position: 'relative' }} ref={dropRef}>
          <button
            className="topbar__user"
            onClick={() => setDropOpen(d => !d)}
          >
            <div className="topbar__avatar">{initials}</div>
            <div className="topbar__user-info">
              <div className="topbar__user-name">
                {profile?.full_name ?? profile?.email}
              </div>
              <div className="topbar__user-role">
                {roleLabel[profile?.role ?? ''] ?? profile?.role}
              </div>
            </div>
            <span style={{ fontSize: '.625rem', color: 'var(--subtle-2)', marginLeft: '.25rem' }}>▼</span>
          </button>

          {dropOpen && (
            <div className="topbar__dropdown">
              <button
                className="topbar__dropdown-item"
                onClick={() => { setDropOpen(false); navigate('/perfil') }}
              >
                👤 Meu perfil
              </button>
              <div className="topbar__dropdown-divider" />
              <button
                className="topbar__dropdown-item topbar__dropdown-item--danger"
                onClick={() => { setDropOpen(false); void signOut() }}
              >
                🚪 Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
