import { Menu } from '@base-ui/react/menu'
import { ArrowUpRight, CalendarDays, ClipboardList, FileText, GitFork, LogOut, PawPrint, ReceiptText, Route, ShieldCheck, Truck, UsersRound } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { BrandLogo } from './brand-logo'
import { clientSections, dashboardPathFor } from '../lib/dashboard-navigation'
import type { AppRole, NavSection } from '../lib/types'

const navigationItems = [
  ['cartas', 'Cartas de porte', FileText],
  ['plantillas', 'Rutas preestablecidas', GitFork],
  ['rutas', 'Rutas', Route],
  ['furgoneta', 'Furgoneta', Truck],
  ['clientes', 'Clientes', UsersRound],
  ['facturas', 'Facturas', ReceiptText],
  ['solicitudes', 'Solicitudes', ClipboardList],
  ['proximas-rutas', 'Próximas rutas', CalendarDays],
  ['mis-transportes', 'Mis transportes', PawPrint],
] as const satisfies ReadonlyArray<readonly [NavSection, string, typeof Route]>

const transporterSections = new Set<NavSection>(['rutas', 'facturas'])

type Props = {
  section: NavSection
  pendingLetters: number
  role: AppRole
  displayName: string
  onNavigate: (section: NavSection) => void
  onSignOut: () => void
  children: ReactNode
}

export function DashboardLayout({ section, pendingLetters, role, displayName, onNavigate, onSignOut, children }: Props) {
  const visibleItems = role === 'transportista'
    ? navigationItems.filter(([id]) => transporterSections.has(id))
    : role === 'cliente' ? navigationItems.filter(([id]) => clientSections.has(id)) : navigationItems.filter(([id]) => !clientSections.has(id))
  const title = visibleItems.find(([id]) => id === section)?.[1] ?? 'Rutas'
  const initials = displayName.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'US'
  const roleLabel = role === 'admin' ? 'Administración' : role === 'cliente' ? 'Cliente' : 'Transportista'
  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>, target: NavSection) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(target)
  }
  const renderNavigation = (mobile = false) => visibleItems.map(([id, label, Icon]) => <a href={dashboardPathFor(id)} className={mobile ? (section === id ? 'is-active' : '') : `nav-item ${section === id ? 'is-active' : ''}`} aria-current={section === id ? 'page' : undefined} key={id} onClick={(event) => handleNavigation(event, id)}><Icon size={mobile ? 19 : 18} /><span>{mobile ? label.split(' ')[0] : label}</span>{!mobile && id === 'cartas' && <b>{pendingLetters}</b>}</a>)

  return <div className="app-shell"><aside className="sidebar" aria-label="Navegación principal"><div className="brand"><BrandLogo variant="dark" /><span>Transporte<br />de mascotas</span></div><div className="workspace-label">{role === 'admin' ? 'OPERACIONES' : 'MI JORNADA'}</div><nav>{renderNavigation()}</nav><div className="sidebar-footer"><div className="sidebar-profile"><Menu.Root modal={false}><Menu.Trigger className="profile-trigger"><span className="avatar">{initials}</span><span><strong>{displayName}</strong><span className="role-dot"><ShieldCheck size={13} /> {roleLabel}</span></span></Menu.Trigger><Menu.Portal><Menu.Positioner className="profile-menu-positioner" side="top" align="start" sideOffset={10}><Menu.Popup className="profile-menu"><div className="profile-menu-header"><span>Cuenta</span><strong>{displayName}</strong></div><Menu.Item className="profile-menu-item" onClick={onSignOut}><LogOut size={15} /> Cerrar sesión</Menu.Item></Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root></div><a className="help-link" href="https://app.doscientos.es/p/project/6660a4cc88ca3804cdcc1b1291376536aee83f74c028dd25">Ayuda y soporte <ArrowUpRight size={14} /></a></div></aside><main><header className="topbar"><h1>{title}</h1></header><div className="page-content">{children}</div></main><nav className="mobile-nav" aria-label="Navegación móvil">{renderNavigation(true)}</nav></div>
}
