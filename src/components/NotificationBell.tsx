import { useEffect, useState } from 'react'
import { getUnreadNotifications, markNotificationRead } from '../lib/api'
import type { Notification } from '../types/app.types'

type Props = { userId: string }

export default function NotificationBell({ userId }: Props) {
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  async function load() {
    const { data } = await getUnreadNotifications(userId)
    setNotifs((data ?? []) as Notification[])
  }

  useEffect(() => {
    void load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [userId])

  async function handleRead(n: Notification) {
    await markNotificationRead(n.id)
    setNotifs(p => p.filter(x => x.id !== n.id))
  }

  return (
    <div className="bell-wrap">
      <button
        className="bell"
        onClick={() => setOpen(o => !o)}
        aria-label={`${notifs.length} notificações não lidas`}
      >
        🔔
        {notifs.length > 0 && (
          <span className="bell__badge">{notifs.length > 9 ? '9+' : notifs.length}</span>
        )}
      </button>

      {open && (
        <div className="bell__panel">
          <p className="bell__heading">Notificações</p>
          {notifs.length === 0 && <p className="sutil" style={{ padding: '0.5rem 1rem' }}>Nenhuma nova.</p>}
          {notifs.map(n => (
            <div key={n.id} className="bell__item">
              <div>
                <p className="bell__item-title">{n.title}</p>
                {n.body && <p className="bell__item-body">{n.body}</p>}
              </div>
              <button className="link" onClick={() => handleRead(n)}>✓</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
