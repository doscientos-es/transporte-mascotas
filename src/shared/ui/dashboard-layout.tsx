import { Avatar, AvatarFallback, Menu, MenuContent, MenuItem, MenuTrigger } from '@doscientos/ui'
import {
  CalendarDays,
  ClipboardList,
  FileText,
  GitFork,
  LogOut,
  PawPrint,
  ReceiptText,
  Route,
  Settings,
  ShieldCheck,
  Truck,
  UsersRound,
} from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'

import { clientSections } from '@/shared/application/dashboard-sections'
import { isClientRole, type AppRole, type NavSection } from '@/shared/types'
import { BrandLogo } from '@/shared/ui/brand-logo'

const navigationItems = [
  ['cartas', 'Cartas de porte', FileText],
  ['plantillas', 'Rutas preestablecidas', GitFork],
  ['rutas', 'Rutas', Route],
  ['furgoneta', 'Furgoneta', Truck],
  ['clientes', 'Clientes', UsersRound],
  ['facturas', 'Facturas', ReceiptText],
  ['solicitudes', 'Solicitudes', ClipboardList],
  ['ajustes', 'Ajustes', Settings],
  ['proximas-rutas', 'Próximas rutas', CalendarDays],
  ['mis-transportes', 'Mis transportes', PawPrint],
  ['mis-mascotas', 'Mis mascotas', PawPrint],
] as const satisfies ReadonlyArray<readonly [NavSection, string, typeof Route]>

const transporterSections = new Set<NavSection>(['rutas', 'facturas'])

type Props = {
  section: NavSection
  pendingLetters: number
  profileRole: AppRole
  displayName: string
  onNavigate: (section: NavSection) => void
  hrefForSection: (section: NavSection) => string
  onSignOut: () => void
  title?: string
  children: ReactNode
}

export function DashboardLayout({
  section,
  pendingLetters,
  profileRole,
  displayName,
  onNavigate,
  hrefForSection,
  onSignOut,
  title,
  children,
}: Props) {
  const visibleItems =
    profileRole === 'transportista'
      ? navigationItems.filter(([id]) => transporterSections.has(id))
      : isClientRole(profileRole)
        ? navigationItems.filter(([id]) => clientSections.has(id))
        : navigationItems.filter(([id]) => !clientSections.has(id))
  const pageTitle = title ?? visibleItems.find(([id]) => id === section)?.[1] ?? 'Rutas'
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'US'
  const roleLabel =
    profileRole === 'admin'
      ? 'Administración'
      : isClientRole(profileRole)
        ? 'Cliente'
        : 'Transportista'
  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>, target: NavSection) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    event.preventDefault()
    onNavigate(target)
  }
  const renderNavigation = (mobile = false) =>
    visibleItems.map(([id, label, Icon]) => (
      <a
        href={hrefForSection(id)}
        className={
          mobile
            ? section === id
              ? 'is-active'
              : ''
            : `nav-item ${section === id ? 'is-active' : ''}`
        }
        aria-current={section === id ? 'page' : undefined}
        key={id}
        onClick={(event) => handleNavigation(event, id)}
      >
        <Icon size={mobile ? 19 : 18} />
        <span>{mobile ? label.split(' ')[0] : label}</span>
        {!mobile && id === 'cartas' && <b>{pendingLetters}</b>}
      </a>
    ))

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand">
          <BrandLogo variant="dark" />
          <span>Kache Envíos</span>
        </div>
        <div className="workspace-label">
          {profileRole === 'admin'
            ? 'OPERACIONES'
            : isClientRole(profileRole)
              ? 'MI ÁREA'
              : 'MI JORNADA'}
        </div>
        <nav>{renderNavigation()}</nav>
        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <MenuTrigger>
              <button type="button" className="profile-trigger" aria-label="Abrir menú de perfil">
                <Avatar className="avatar">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span>
                  <strong>{displayName}</strong>
                  <span className="role-dot">
                    <ShieldCheck size={13} /> {roleLabel}
                  </span>
                </span>
              </button>
              <MenuContent className="profile-menu">
                <div className="profile-menu-header">
                  <span>Cuenta</span>
                  <strong>{displayName}</strong>
                </div>
                <Menu aria-label="Acciones de cuenta">
                  <MenuItem className="profile-menu-item" id="sign-out" onAction={onSignOut}>
                    <LogOut size={15} /> Cerrar sesión
                  </MenuItem>
                </Menu>
              </MenuContent>
            </MenuTrigger>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <h1>{pageTitle}</h1>
        </header>
        <div className="page-content">{children}</div>
      </main>
      <nav className="mobile-nav" aria-label="Navegación móvil">
        {renderNavigation(true)}
      </nav>
    </div>
  )
}
