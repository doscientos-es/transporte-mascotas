import {
  Avatar,
  AvatarFallback,
  MobileNavigation,
  MobileNavigationItem,
  PopoverContent,
  PopoverTrigger,
} from '@doscientos/ui'
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
  ['plantillas', 'Plantillas', GitFork],
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
  headerAction,
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
        {id === 'cartas' && (
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
        label={label.split(' ')[0]}
        active={section === id}
        onClick={(event) => handleNavigation(event, id)}
      />
    ))

  return (
    <div className="grid min-h-dvh grid-cols-[260px_minmax(0,1fr)] bg-[#f7f7f7] max-[850px]:block max-[850px]:pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <aside
        className="sticky top-0 flex h-dvh min-h-dvh flex-col bg-[#171717] px-[14px] py-[22px] text-[#f5f5f5] max-[850px]:hidden"
        aria-label="Navegación principal"
      >
        <div className="flex items-center gap-[11px] px-2.5 pt-0.5 pb-7 text-sm leading-[1.05] font-[650] text-white">
          <BrandLogo variant="dark" className="h-[34px] w-[42px] rounded-md object-contain" />
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
        <div className="mt-auto grid gap-3 border-t border-[#3b3b3b] px-2.5 pt-4 pb-1 text-xs">
          <div className="relative">
            <PopoverTrigger>
              <button
                type="button"
                className="flex min-h-[52px] w-full cursor-pointer items-center gap-2.5 rounded-[10px] bg-transparent p-2 text-left text-inherit transition-colors hover:bg-[#303030] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] data-[popup-open]:bg-[#303030]"
                aria-label="Abrir menú de perfil"
              >
                <Avatar className="grid size-9 shrink-0 place-items-center rounded-full bg-[#171717] text-xs font-bold text-white">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <strong className="block text-[13px] text-[#f1f6ef]">{displayName}</strong>
                  <span className="mt-0.5 flex items-center gap-[5px] text-[#bdbdbd]">
                    <ShieldCheck size={13} /> {roleLabel}
                  </span>
                </span>
              </button>
              <PopoverContent
                placement="top start"
                className="min-w-[196px] rounded-xl border-[#4a4a4a] bg-[#171717] p-2 shadow-[0_14px_30px_rgb(0_0_0_/_42%)]"
              >
                <div className="grid gap-0.5 border-b border-[#3b3b3b] px-2 pt-1 pb-2.5">
                  <span className="text-[10px] font-[750] tracking-[0.1em] text-[#bdbdbd] uppercase">
                    Cuenta
                  </span>
                  <strong className="text-[13px] text-[#f1f6ef]">{displayName}</strong>
                </div>
                <button
                  type="button"
                  className="mt-1.5 flex min-h-[38px] w-full items-center gap-2 rounded-md bg-transparent px-[9px] text-left text-xs text-white hover:bg-[#3b2022] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] data-[highlighted]:bg-[#3b2022]"
                  onClick={onSignOut}
                >
                  <LogOut size={15} /> Cerrar sesión
                </button>
              </PopoverContent>
            </PopoverTrigger>
          </div>
        </div>
      </aside>
      <main className="min-w-0">
        <header className="mx-auto flex w-full max-w-[1440px] items-center gap-2.5 px-[clamp(20px,4vw,52px)] pt-6 max-[850px]:px-[18px] max-[850px]:pt-[17px]">
          <h1 className="m-0 text-[25px] tracking-[-0.04em] text-[#171717] max-[850px]:text-[21px]">
            {pageTitle}
          </h1>
          {headerAction && <div className="ml-auto">{headerAction}</div>}
        </header>
        <div
          data-dashboard-content
          className="mx-auto max-w-[1440px] px-[clamp(20px,4vw,52px)] pt-3 pb-14 max-[850px]:px-4 max-[850px]:pt-[22px] max-[850px]:pb-9"
        >
          {children}
        </div>
      </main>
      <MobileNavigation
        sticky={false}
        aria-label="Navegación móvil"
        className="fixed right-0 bottom-0 left-0 hidden border-[#dedede] bg-white text-[#171717] max-[850px]:block"
      >
        {renderMobileNavigation()}
      </MobileNavigation>
    </div>
  )
}
