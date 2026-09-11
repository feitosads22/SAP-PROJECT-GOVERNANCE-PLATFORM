import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type Props = { open: boolean; onClose: () => void }

const NAV = [
  { group:'principal', label:'Principal', items:[
    { to:'/dashboard', label:'Dashboard',   icon:'⊞', roles:['admin','manager'] },
    { to:'/dashboard', label:'Meu Painel',  icon:'⊞', roles:['consultant'] },
    { to:'/',          label:'Projetos',    icon:'📁', roles:['admin','manager'] },
    { to:'/portfolio', label:'Portfólio',   icon:'📊', roles:['admin','manager'] },
    { to:'/demandas',  label:'Demandas',    icon:'📋', roles:['admin','manager'] },
  ]},
  { group:'execucao', label:'Execução', items:[
    { to:'/minhas',     label:'Minhas Tarefas', icon:'✓'  },
    { to:'/timesheet',  label:'Timesheet',      icon:'⏱' },
    { to:'/capacidade', label:'Capacidade',     icon:'👥', roles:['admin','manager'] },
  ]},
  { group:'analise', label:'Análise', items:[
    { to:'/relatorios',  label:'Relatórios',   icon:'📈', roles:['admin','manager'] },
    { to:'/documentos',  label:'Documentos',   icon:'📄', roles:['admin','manager','consultant'] },
    { to:'/knowledge',   label:'IA & Conhec.', icon:'🤖', roles:['admin','manager','consultant'] },
  ]},
  { group:'admin', label:'Administração', items:[
    { to:'/equipe',        label:'Usuários & Perfis', icon:'👤', roles:['admin','manager'] },
    { to:'/recursos',      label:'Recursos',          icon:'🧑‍💼', roles:['admin','manager'] },
    { to:'/configuracoes', label:'Configurações',      icon:'⚙️', roles:['admin'] },
  ]},
  { group:'cliente', label:'Cliente', items:[
    { to:'/portal-cliente', label:'Meus Projetos', icon:'🏢', roles:['customer'] },
  ]},
]

export default function AppSidebar({ open, onClose }: Props) {
  const { pathname } = useLocation()
  const { profile, organization } = useAuth()
  const role = profile?.role ?? ''

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to)

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          {organization?.logo_url ? (
            <img src={organization.logo_url} alt={organization.name} className="sidebar__brand-icon" style={{ objectFit: 'cover' }} />
          ) : (
            <div className="sidebar__brand-icon">⬡</div>
          )}
          <div>
            <div className="sidebar__brand-name">{organization?.name ?? 'SAP Governance'}</div>
            <div className="sidebar__brand-sub">{organization ? 'Gestão de Projetos SAP · System_2F' : 'Gestão de Projetos SAP'}</div>
          </div>
        </div>

        <nav className="sidebar__nav">
          {NAV.map(group => {
            const items = group.items.filter(i => !(i as {roles?:string[]}).roles || (i as {roles?:string[]}).roles!.includes(role))
            if (!items.length) return null
            return (
              <div key={group.group}>
                <div className="sidebar__group-label">{group.label}</div>
                {items.map(item => (
                  <Link key={item.to} to={item.to}
                    className={`sidebar__link${isActive(item.to) ? ' sidebar__link--active' : ''}`}
                    onClick={onClose}>
                    <span className="sidebar__link-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
                <div className="sidebar__divider" />
              </div>
            )
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__footer-name">{organization?.name ?? 'SAP Governance'}</div>
          <div className="sidebar__footer-tagline">Melhores decisões,{'\n'}melhores resultados.</div>
        </div>
      </aside>
    </>
  )
}
