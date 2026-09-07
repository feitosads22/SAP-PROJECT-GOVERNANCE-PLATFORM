import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type Props = { open: boolean; onClose: () => void }

type NavItem = {
  to: string; label: string; icon: string;
  roles?: string[]; badge?: number; group?: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',  label: 'Dashboard',    icon: '⊞',  group: 'main' },
  { to: '/',           label: 'Projetos',      icon: '📁',  group: 'main' },
  { to: '/portfolio',  label: 'Portfólio',     icon: '📊',  group: 'main' },
  { to: '/knowledge',  label: 'IA & Conhec.',  icon: '🤖',  group: 'main', roles: ['admin','manager','consultant'] },
  { to: '/minhas',     label: 'Minhas Tarefas',icon: '✓',  group: 'exec', roles: ['admin','manager','consultant'] },
  { to: '/timesheet',  label: 'Timesheet',     icon: '⏱',  group: 'exec', roles: ['admin','manager','consultant'] },
  { to: '/capacidade', label: 'Capacidade',    icon: '👥',  group: 'exec', roles: ['admin','manager'] },
  { to: '/portal-cliente', label: 'Meus Projetos', icon: '🏢', group: 'exec', roles: ['customer'] },
]

const GROUP_LABELS: Record<string, string> = {
  main: 'Governança',
  exec: 'Execução',
}

export default function AppSidebar({ open, onClose }: Props) {
  const { pathname } = useLocation()
  const { profile } = useAuth()
  const role = profile?.role ?? ''

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to)

  const groups = ['main', 'exec']
  const visibleItems = NAV_ITEMS.filter(item =>
    !item.roles || item.roles.includes(role)
  )

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
        {/* Brand */}
        <div className="sidebar__brand">
          <div className="sidebar__brand-icon">⬡</div>
          <div>
            <div className="sidebar__brand-name">SAP Governance</div>
            <div className="sidebar__brand-sub">Gestão de Projetos SAP</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar__nav">
          {groups.map(group => {
            const items = visibleItems.filter(i => i.group === group)
            if (!items.length) return null
            return (
              <div key={group}>
                <div className="sidebar__group-label">{GROUP_LABELS[group]}</div>
                {items.map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`sidebar__link${isActive(item.to) ? ' sidebar__link--active' : ''}`}
                    onClick={onClose}
                  >
                    <span className="sidebar__link-icon">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span className="sidebar__link-badge">{item.badge}</span>
                    ) : null}
                  </Link>
                ))}
                <div className="sidebar__divider" />
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar__footer">
          <div className="sidebar__footer-name">SAP Governance</div>
          <div className="sidebar__footer-tagline">Melhores decisões,{'\n'}melhores resultados.</div>
        </div>
      </aside>
    </>
  )
}
