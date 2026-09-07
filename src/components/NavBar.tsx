import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from './NotificationBell'

export default function NavBar() {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const role = profile?.role ?? ''
  const isCustomer = role === 'customer'

  const links = isCustomer
    ? [
        { to: '/portal-cliente', label: '📋 Meus Projetos' },
      ]
    : [
        { to: '/portfolio',  label: 'Portfolio' },
        { to: '/knowledge',  label: '🤖 IA' },
        { to: '/',           label: 'Projetos' },
        { to: '/minhas',     label: 'Minhas tarefas' },
        { to: '/timesheet',  label: 'Timesheet' },
        { to: '/capacidade', label: 'Capacidade' },
      ]

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to)

  return (
    <nav className="navbar">
      <span className="navbar__brand">SAP Governance</span>

      <div className="navbar__links">
        {links.map(l => (
          <Link key={l.to} to={l.to}
            className={`navbar__link${isActive(l.to) ? ' navbar__link--active' : ''}`}>
            {l.label}
          </Link>
        ))}
      </div>

      <div className="navbar__right">
        {!isCustomer && <NotificationBell userId={profile?.id ?? ''} />}
        <span className="navbar__user">{profile?.full_name ?? profile?.email}</span>
        <button className="btn-ghost" style={{ fontSize:'0.8125rem' }} onClick={signOut}>
          Sair
        </button>
      </div>
    </nav>
  )
}
