import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from './NotificationBell'

export default function NavBar() {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()

  const links = [
    { to: '/',         label: 'Projetos' },
    { to: '/minhas',   label: 'Minhas tarefas' },
    { to: '/timesheet',  label: 'Timesheet' },
    { to: '/capacidade', label: 'Capacidade' },
  ]

  return (
    <nav className="navbar">
      <span className="navbar__brand">SAP Governance</span>
      <div className="navbar__links">
        {links.map(l => (
          <Link
            key={l.to}
            to={l.to}
            className={`navbar__link${pathname === l.to ? ' navbar__link--active' : ''}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <div className="navbar__right">
        {profile?.id && <NotificationBell userId={profile.id} />}
        <span className="sutil">{profile?.full_name ?? profile?.email}</span>
        <button className="link" onClick={signOut}>Sair</button>
      </div>
    </nav>
  )
}
