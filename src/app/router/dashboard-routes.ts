import type { NavSection } from '@/shared/types'

export const dashboardPaths: Record<NavSection, string> = {
  cartas: '/cartas',
  plantillas: '/rutas-preestablecidas',
  rutas: '/rutas',
  furgoneta: '/furgoneta',
  clientes: '/clientes',
  facturas: '/facturas',
  solicitudes: '/solicitudes',
  ajustes: '/ajustes',
  'whatsapp-test': '/ajustes/whatsapp',
  'proximas-rutas': '/proximas-rutas',
  'mis-transportes': '/mis-transportes',
  'mis-mascotas': '/mis-mascotas',
}

export type DashboardLocation = {
  section: NavSection
  routeId?: string
}

export function dashboardLocationForPath(
  pathname: string,
  fallback: NavSection = 'cartas',
): DashboardLocation {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return { section: fallback }
  if (path === dashboardPaths.cartas) return { section: 'cartas' }
  if (path === dashboardPaths.plantillas) return { section: 'plantillas' }
  if (path === dashboardPaths.furgoneta) return { section: 'furgoneta' }
  if (path === dashboardPaths.clientes) return { section: 'clientes' }
  if (path === dashboardPaths.facturas) return { section: 'facturas' }
  if (path === dashboardPaths.solicitudes) return { section: 'solicitudes' }
  if (path === dashboardPaths.ajustes) return { section: 'ajustes' }
  if (path === dashboardPaths['whatsapp-test']) return { section: 'whatsapp-test' }
  if (path === dashboardPaths['proximas-rutas']) return { section: 'proximas-rutas' }
  if (path === dashboardPaths['mis-transportes']) return { section: 'mis-transportes' }
  if (path === dashboardPaths['mis-mascotas']) return { section: 'mis-mascotas' }
  if (path === dashboardPaths.rutas) return { section: 'rutas' }

  const vanMatch = path.match(/^\/furgoneta\/([^/]+)$/)
  if (vanMatch) return { section: 'furgoneta', routeId: decodeURIComponent(vanMatch[1]) }

  const routeMatch = path.match(/^\/rutas\/([^/]+)$/)
  if (routeMatch) return { section: 'rutas', routeId: decodeURIComponent(routeMatch[1]) }

  return { section: fallback }
}

export function isDashboardPath(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/'
  return (
    path === '/' ||
    Object.values(dashboardPaths).includes(path) ||
    /^\/(?:rutas|furgoneta)\/[^/]+$/.test(path)
  )
}

export function dashboardPathFor(section: NavSection) {
  return dashboardPaths[section]
}

export function routePathFor(routeId: string) {
  return `${dashboardPaths.rutas}/${encodeURIComponent(routeId)}`
}

export function vanPathFor(routeId: string) {
  return `${dashboardPaths.furgoneta}/${encodeURIComponent(routeId)}`
}
