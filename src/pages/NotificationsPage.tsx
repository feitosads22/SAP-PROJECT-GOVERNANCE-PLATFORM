import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type Notif = {
  id: string; title: string; body: string | null; type: string
  read_at: string | null; created_at: string; project_id: string | null
  entity_type: string | null; entity_id: string | null
}

const TYPE_CFG: Record<string, { icon: string; color: string; bg: string }> = {
  task_assigned:     { icon: '✓', color: '#0A6ED1', bg: '#EBF5FB' },
  task_due:          { icon: '⏰', color: '#F59E0B', bg: '#FEF9E7' },
  task_overdue:      { icon: '⚠️', color: '#DC2626', bg: '#FDEDEC' },
  risk_new:          { icon: '⚠️', color: '#DC2626', bg: '#FDEDEC' },
  issue_new:         { icon: '🔴', color: '#DC2626', bg: '#FDEDEC' },
  cr_submitted:      { icon: '📋', color: '#7C3AED', bg: '#F4ECF7' },
  cr_approved:       { icon: '✅', color: '#16A34A', bg: '#EAFAF1' },
  cr_rejected:       { icon: '✗',  color: '#DC2626', bg: '#FDEDEC' },
  milestone_due:     { icon: '🔷', color: '#0A6ED1', bg: '#EBF5FB' },
  evidence_required: { icon: '📎', color: '#F59E0B', bg: '#FEF9E7' },
  timesheet_rejected:{ icon: '✗',  color: '#DC2626', bg: '#FDEDEC' },
  general:           { icon: '💬', color: '#64748B', bg: '#F8F9FA' },
}

function timeAgo(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000
  if (diff < 60)    return 'agora'
  if (diff < 3600)  return `há ${Math.round(diff/60)} min`
  if (diff < 86400) return `há ${Math.round(diff/3600)} h`
  if (diff < 604800)return `há ${Math.round(diff/86400)} d`
  return new Date(date).toLocaleDateString('pt-BR')
}

export default function NotificationsPage() {
  const { profile } = useAuth()
  const [notifs,   setNotifs]   = useState<Notif[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<'all'|'unread'>('all')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  async function load() {
    setLoading(true)
    const { data } = await sb.from('notifications')
      .select('*')
      .eq('user_id', profile?.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setNotifs(data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [profile?.id])

  // Real-time subscription
  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase.channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, () => { void load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  async function markRead(id: string) {
    const now = new Date().toISOString()
    await sb.from('notifications').update({ read_at: now }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read_at: now } : n))
  }

  async function markAllRead() {
    const now = new Date().toISOString()
    await sb.from('notifications')
      .update({ read_at: now }).eq('user_id', profile?.id).is('read_at', null)
    setNotifs(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? now })))
  }

  const displayed = filter === 'unread' ? notifs.filter(n => !n.read_at) : notifs
  const unreadCount = notifs.filter(n => !n.read_at).length

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div>
          <div className="page-header__eyebrow">Sistema</div>
          <h1>Notificações</h1>
          <p className="page-header__sub">
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Tudo lido'}
          </p>
        </div>
        <div className="page-header__actions">
          {unreadCount > 0 && (
            <button className="btn-secondary" onClick={markAllRead}>
              ✓ Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button className={`tab-btn${filter === 'all' ? ' tab-btn--active' : ''}`}
          onClick={() => setFilter('all')}>
          Todas ({notifs.length})
        </button>
        <button className={`tab-btn${filter === 'unread' ? ' tab-btn--active' : ''}`}
          onClick={() => setFilter('unread')}>
          Não lidas ({unreadCount})
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {[1,2,3,4,5].map(i => <div key={i} style={{ height: 72, borderRadius: 'var(--r-lg)' }} className="skeleton" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🔔</div>
          <div className="empty-state__title">
            {filter === 'unread' ? 'Nenhuma notificação não lida' : 'Sem notificações'}
          </div>
          <p className="empty-state__desc">Você está em dia com tudo!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {displayed.map(n => {
            const cfg = TYPE_CFG[n.type] ?? TYPE_CFG.general
            return (
              <div key={n.id}
                onClick={() => !n.read_at && markRead(n.id)}
                style={{
                  display: 'flex', gap: '.875rem', alignItems: 'flex-start',
                  background: n.read_at ? 'var(--surface)' : cfg.bg,
                  border: `1px solid ${n.read_at ? 'var(--border)' : cfg.color + '33'}`,
                  borderLeft: `3px solid ${n.read_at ? 'var(--border)' : cfg.color}`,
                  borderRadius: 'var(--r-lg)', padding: '1rem',
                  cursor: n.read_at ? 'default' : 'pointer',
                  transition: 'background .15s',
                }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: cfg.bg, color: cfg.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', flexShrink: 0,
                  border: `1px solid ${cfg.color}33`,
                }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
                    <span style={{ fontWeight: n.read_at ? 500 : 700, fontSize: '.9375rem', color: 'var(--text)' }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: '.6875rem', color: 'var(--subtle-2)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  {n.body && (
                    <p style={{ fontSize: '.8125rem', color: 'var(--subtle)', marginTop: '.25rem', lineHeight: 1.5 }}>
                      {n.body}
                    </p>
                  )}
                  {!n.read_at && (
                    <div style={{ marginTop: '.375rem', display: 'flex', alignItems: 'center', gap: '.375rem' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color }} />
                      <span style={{ fontSize: '.6875rem', color: cfg.color, fontWeight: 700 }}>Nova</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
