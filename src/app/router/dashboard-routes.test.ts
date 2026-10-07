import { describe, expect, it } from 'vitest'

import type { NavSection } from '@/shared/types'

import {
  APP_PATHS,
  dashboardLocationForPath,
  dashboardPathFor,
  dashboardPaths,
  isStaffAccessPath,
  letterCreatePath,
  paymentReturnStateFromSearch,
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
    expect(letterCreatePath).toBe('/cartas/nueva')
    expect(ROUTER_PATHS.adminLetterCreate).toBe('cartas/nueva')
    expect(dashboardLocationForPath(letterCreatePath)).toEqual({ section: 'cartas' })
    expect(APP_PATHS.clientHome).toBe('/mis-transportes')
    expect(APP_PATHS.passwordRecovery).toBe('/recuperar-contrasena')
    expect(APP_PATHS.passwordReset).toBe('/restablecer-contrasena')
    expect(APP_PATHS.paymentLaunch).toBe('/pagar')
    expect(ROUTER_PATHS.paymentLaunch).toBe('pagar')
    expect(ROUTER_PATHS.passwordReset).toBe('restablecer-contrasena')
    expect(ROUTER_PATHS.staffRouteDetail).toBe('rutas/:routeId')
  })

  it('maps every dashboard section and safely falls back for unknown paths', () => {
    expect(Object.entries(dashboardPaths)).toHaveLength(10)
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

  it('preserves the payment kind identifier when returning from the gateway', () => {
    expect(paymentReturnStateFromSearch('?payment=ok&invoice=invoice-1')).toEqual({
      paymentStatus: 'ok',
      paymentInvoiceId: 'invoice-1',
    })
    expect(paymentReturnStateFromSearch('?payment=ko&request=request-1')).toEqual({
      paymentStatus: 'ko',
      paymentRequestId: 'request-1',
    })
    expect(paymentReturnStateFromSearch('?payment=unknown')).toBeUndefined()
  })
})
