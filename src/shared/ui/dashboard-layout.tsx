import {
  Button,
  MobileNavigation,
  MobileNavigationItem,
  PopoverContent,
  PopoverTrigger,
} from '@doscientos/ui'
import {
  CalendarDays,
  ChevronsUpDown,
  ClipboardList,
  FilePlus2,
  FileText,
  GitFork,
  Landmark,
  LogOut,
  PawPrint,
  ReceiptText,
  Route,
  Settings,
  Truck,
  UsersRound,
} from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'

import { clientSections } from '@/shared/application/dashboard-sections'
import { isClientRole, type AppRole, type NavSection } from '@/shared/types'
import { BrandLogo } from '@/shared/ui/brand-logo'

const navigationItems = [
  ['cartas', 'Cartas de porte', FileText],
  ['plantillas', 'Plantillas', GitFork],
  ['rutas', 'Rutas', Route],
  ['furgoneta', 'Furgoneta', Truck],
  ['clientes', 'Clientes', UsersRound],
  ['facturas', 'Facturas', ReceiptText],
  ['finanzas', 'Finanzas', Landmark],
  ['solicitudes', 'Solicitudes', ClipboardList],
  ['ajustes', 'Ajustes', Settings],
  ['proximas-rutas', 'Próximas rutas', CalendarDays],
  ['mis-transportes', 'Mis transportes', PawPrint],
  ['solicitar-transporte', 'Solicitar transporte', FilePlus2],
] as const satisfies ReadonlyArray<readonly [NavSection, string, typeof Route]>

const mobileNavigationLabels: Partial<Record<NavSection, string>> = {
  'proximas-rutas': 'Rutas',
  'mis-transportes': 'Transportes',
  'solicitar-transporte': 'Solicitar',
}

type Props = {
  section: NavSection
  pendingLetters: number
  profileRole: AppRole
  displayName: string
  onNavigate: (section: NavSection) => void
  hrefForSection: (section: NavSection) => string
  onSignOut: () => void
  title?: string
  /** Oculta visualmente el título de página (sigue disponible para lectores de pantalla). */
  hideTitle?: boolean
  headerAction?: ReactNode
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
  hideTitle,
  headerAction,
  children,
}: Props) {
  const visibleItems = isClientRole(profileRole)
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
  const roleLabel = profileRole === 'admin' ? 'Administración' : 'Cliente'
  const handleNavigation = (event: MouseEvent<Element>, target: NavSection) => {
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
  const renderDesktopNavigation = () =>
    visibleItems.map(([id, label, Icon]) => (
      <a
        href={hrefForSection(id)}
        className={
          section === id
            ? 'flex min-h-11 items-center gap-[11px] rounded-[9px] bg-[var(--accent)] px-[11px] text-sm font-bold text-white no-underline'
            : 'flex min-h-11 items-center gap-[11px] rounded-[9px] px-[11px] text-sm text-[#bdbdbd] no-underline hover:bg-[#303030] hover:text-white'
        }
        aria-current={section === id ? 'page' : undefined}
        key={id}
        onClick={(event) => handleNavigation(event, id)}
      >
        <Icon size={18} />
        <span>{label}</span>
        {id === 'cartas' && pendingLetters > 0 && (
          <b className="ml-auto grid size-5 place-items-center rounded-full bg-white/20 text-[11px]">
            {pendingLetters}
          </b>
        )}
      </a>
    ))

  const renderMobileNavigation = () =>
    visibleItems.map(([id, label, Icon]) => (
      <MobileNavigationItem
        key={id}
        href={hrefForSection(id)}
        icon={<Icon />}
        label={mobileNavigationLabels[id] ?? label.split(' ')[0]}
        active={section === id}
        onClick={(event) => handleNavigation(event, id)}
      />
    ))

  const renderAccountMenu = (placement: 'top start' | 'bottom end') => (
    <PopoverTrigger>
      <Button
        type="button"
        className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-left text-inherit transition-colors hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] data-[popup-open]:border-white/20 data-[popup-open]:bg-white/[0.08]"
        aria-label="Abrir menú de perfil"
      >
        <span
          className="kache-account-initials hidden size-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white"
          aria-hidden="true"
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-[13px] font-semibold text-white">
            {displayName}
          </strong>
          <span className="mt-0.5 block truncate text-xs text-[#a3a3a3]">{roleLabel}</span>
        </span>
        <ChevronsUpDown size={16} className="shrink-0 text-[#8a8a8a]" aria-hidden="true" />
      </Button>
      <PopoverContent
        placement={placement}
        className="w-[240px] min-w-[240px] rounded-xl border border-white/10 bg-[#171717] p-1.5 text-white shadow-[0_16px_40px_rgb(0_0_0_/_50%)]"
      >
        <div className="flex items-center gap-3 px-2.5 py-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
            {initials}
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-sm font-semibold text-white">
              {displayName}
            </strong>
            <span className="block text-xs text-[#a3a3a3]">{roleLabel}</span>
          </span>
        </div>
        <div className="my-1 h-px bg-white/10" />
        <button
          type="button"
          className="flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg bg-transparent px-2.5 text-left text-sm font-medium text-[#e5e5e5] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] data-[highlighted]:bg-white/10"
          onClick={onSignOut}
        >
          <LogOut size={16} className="text-[var(--accent)]" /> Cerrar sesión
        </button>
      </PopoverContent>
    </PopoverTrigger>
  )

  return (
    <div
      className="kache-dashboard-layout grid min-h-dvh grid-cols-[260px_minmax(0,1fr)] bg-[#f7f7f7]"
      data-role={profileRole}
    >
      <aside
        className="kache-dashboard-sidebar sticky top-0 flex h-dvh min-h-dvh flex-col bg-[#171717] px-[14px] py-[22px] text-[#f5f5f5]"
        aria-label="Navegación principal"
      >
        <div className="flex items-center gap-[11px] px-2.5 pt-0.5 pb-7 text-sm leading-[1.05] font-[650] text-white">
          <BrandLogo className="h-[34px] w-[42px] rounded-md object-contain" />
          <span>Kache Envíos</span>
        </div>
        <div className="px-2.5 pb-2.5 text-[10px] font-[750] tracking-[0.12em] text-[#bdbdbd] uppercase">
          {profileRole === 'admin'
            ? 'OPERACIONES'
            : isClientRole(profileRole)
              ? 'MI ÁREA'
              : 'MI JORNADA'}
        </div>
        <nav className="grid gap-1">{renderDesktopNavigation()}</nav>
        <div className="mt-auto grid gap-3 px-2.5 pt-4 pb-1 text-xs">
          <div className="relative">{renderAccountMenu('top start')}</div>
        </div>
      </aside>
      <main className="min-w-0">
        {hideTitle ? (
          <h1 className="sr-only">{pageTitle}</h1>
        ) : (
          <header className="kache-dashboard-header mx-auto flex w-full max-w-[1200px] items-center gap-2.5 px-6 pt-7 max-[850px]:px-[18px] max-[850px]:pt-[17px]">
            <h1 className="m-0 text-[25px] tracking-[-0.04em] text-[#171717] max-[850px]:text-[21px]">
              {pageTitle}
            </h1>
            {headerAction && <div className="ml-auto">{headerAction}</div>}
          </header>
        )}
        <div
          data-dashboard-content
          className="kache-dashboard-content mx-auto max-w-[1200px] px-6 pt-4 pb-14 max-[850px]:px-4 max-[850px]:pt-[22px] max-[850px]:pb-9"
        >
          {children}
        </div>
      </main>
      <MobileNavigation
        sticky={false}
        aria-label="Navegación móvil"
        className="kache-dashboard-mobile-navigation fixed right-0 bottom-0 left-0 hidden border-[#dedede] bg-white text-[#171717]"
      >
        <div className="kache-mobile-account">{renderAccountMenu('top start')}</div>
        {renderMobileNavigation()}
      </MobileNavigation>
    </div>
  )
}
