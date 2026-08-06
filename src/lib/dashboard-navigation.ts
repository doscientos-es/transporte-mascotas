import type { NavSection } from './types'

export const dashboardPaths: Record<NavSection, string> = {
  cartas: '/cartas',
  plantillas: '/rutas-preestablecidas',
  rutas: '/rutas',
  furgoneta: '/furgoneta',
  clientes: '/clientes',
  facturas: '/facturas',
}

export type DashboardLocation = {
  section: NavSection
  routeId?: string
}

export function dashboardLocationForPath(pathname: string): DashboardLocation {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/' || path === dashboardPaths.cartas) return { section: 'cartas' }
  if (path === dashboardPaths.plantillas) return { section: 'plantillas' }
  if (path === dashboardPaths.furgoneta) return { section: 'furgoneta' }
  if (path === dashboardPaths.clientes) return { section: 'clientes' }
  if (path === dashboardPaths.facturas) return { section: 'facturas' }
  if (path === dashboardPaths.rutas) return { section: 'rutas' }

  const routeMatch = path.match(/^\/rutas\/([^/]+)$/)
  if (routeMatch) return { section: 'rutas', routeId: decodeURIComponent(routeMatch[1]) }

  return { section: 'cartas' }
}

export function isDashboardPath(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/'
  return path === '/' || Object.values(dashboardPaths).includes(path) || /^\/rutas\/[^/]+$/.test(path)
}

export function dashboardPathFor(section: NavSection) {
  return dashboardPaths[section]
}

export function routePathFor(routeId: string) {
  return `${dashboardPaths.rutas}/${encodeURIComponent(routeId)}`
}
