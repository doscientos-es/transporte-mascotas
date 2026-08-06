import { Menu } from '@base-ui/react/menu'
import { ArrowUpRight, FileText, GitFork, LogOut, Route, ShieldCheck, Truck, UsersRound } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import brandLogo from '../assets/kache-logo.png'
import { dashboardPathFor } from '../lib/dashboard-navigation'
import type { NavSection } from '../lib/types'

const navigationItems = [
  ['cartas', 'Cartas de porte', FileText],
  ['plantillas', 'Rutas preestablecidas', GitFork],
  ['rutas', 'Rutas', Route],
  ['furgoneta', 'Furgoneta', Truck],
  ['clientes', 'Clientes', UsersRound],
] as const

type Props = {
  section: NavSection
  pendingLetters: number
  onNavigate: (section: NavSection) => void
  onSignOut: () => void
  children: ReactNode
}

export function DashboardLayout({ section, pendingLetters, onNavigate, onSignOut, children }: Props) {
  const title = navigationItems.find(([id]) => id === section)?.[1]
  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>, target: NavSection) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(target)
  }
  return <div className="app-shell"><aside className="sidebar" aria-label="Navegación principal"><div className="brand"><img src={brandLogo} alt="Kache Envíos" /><span>Transporte<br />de mascotas</span></div><div className="workspace-label">OPERACIONES</div><nav>{navigationItems.map(([id, label, Icon]) => <a href={dashboardPathFor(id)} className={`nav-item ${section === id ? 'is-active' : ''}`} aria-current={section === id ? 'page' : undefined} key={id} onClick={(event) => handleNavigation(event, id)}><Icon size={18} /><span>{label}</span>{id === 'cartas' && <b>{pendingLetters}</b>}</a>)}</nav><div className="sidebar-footer"><div className="sidebar-profile"><Menu.Root modal={false}><Menu.Trigger className="profile-trigger"><span className="avatar">GM</span><span><strong>Gestor</strong><span className="role-dot"><ShieldCheck size={13} /> Sesión segura</span></span></Menu.Trigger><Menu.Portal><Menu.Positioner className="profile-menu-positioner" side="top" align="start" sideOffset={10}><Menu.Popup className="profile-menu"><div className="profile-menu-header"><span>Cuenta</span><strong>Gestor</strong></div><Menu.Item className="profile-menu-item" onClick={onSignOut}><LogOut size={15} /> Cerrar sesión</Menu.Item></Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root></div><a className="help-link" href="mailto:hola@doscientos.es?subject=Ayuda%20y%20soporte%20Kache%20Env%C3%ADos">Ayuda y soporte <ArrowUpRight size={14} /></a></div></aside><main><header className="topbar"><h1>{title}</h1></header><div className="page-content">{children}</div></main><nav className="mobile-nav" aria-label="Navegación móvil">{navigationItems.map(([id, label, Icon]) => <a href={dashboardPathFor(id)} className={section === id ? 'is-active' : ''} aria-current={section === id ? 'page' : undefined} key={id} onClick={(event) => handleNavigation(event, id)}><Icon size={19} /><span>{label.split(' ')[0]}</span></a>)}</nav></div>
}
