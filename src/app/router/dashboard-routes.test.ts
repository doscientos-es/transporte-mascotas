import { describe, expect, it } from 'vitest'

import type { NavSection } from '@/shared/types'

import {
  APP_PATHS,
  DEFAULT_DASHBOARD_SECTIONS,
  dashboardLocationForPath,
  dashboardPathFor,
  dashboardPaths,
  isStaffAccessPath,
  routePathFor,
  ROUTER_PATHS,
  vanPathFor,
} from './dashboard-routes'

describe('dashboard routes', () => {
  it('maps nested route paths and decodes their identifiers', () => {
    expect(dashboardLocationForPath('/rutas/ruta%20norte/')).toEqual({
      section: 'rutas',
      routeId: 'ruta norte',
    })
    expect(dashboardLocationForPath('/furgoneta/van%2F01')).toEqual({
      section: 'furgoneta',
      routeId: 'van/01',
    })
  })

  it('keeps router paths and navigation defaults in one source of truth', () => {
    expect(routePathFor('ruta norte')).toBe('/rutas/ruta%20norte')
    expect(vanPathFor('van/01')).toBe('/furgoneta/van%2F01')
    expect(dashboardLocationForPath('/ajustes/whatsapp')).toEqual({ section: 'whatsapp-test' })
    expect(APP_PATHS.clientHome).toBe('/mis-transportes')
    expect(DEFAULT_DASHBOARD_SECTIONS.transporter).toBe('rutas')
    expect(ROUTER_PATHS.staffRouteDetail).toBe('rutas/:routeId')
  })

  it('maps every dashboard section and safely falls back for unknown paths', () => {
    expect(Object.entries(dashboardPaths)).toHaveLength(12)
    for (const [section, path] of Object.entries(dashboardPaths)) {
      expect(dashboardLocationForPath(path)).toEqual({ section })
      expect(dashboardPathFor(section as NavSection)).toBe(path)
    }
    expect(dashboardLocationForPath('/desconocida', 'clientes')).toEqual({ section: 'clientes' })
    expect(dashboardLocationForPath('/')).toEqual({ section: 'cartas' })
  })

  it('recognises only the staff access path and its children', () => {
    expect(isStaffAccessPath(APP_PATHS.staffAccess)).toBe(true)
    expect(isStaffAccessPath('/admin/acceso')).toBe(true)
    expect(isStaffAccessPath('/administracion')).toBe(false)
  })
})
