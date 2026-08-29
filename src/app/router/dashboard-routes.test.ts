import { describe, expect, it } from 'vitest'

import {
  dashboardLocationForPath,
  isDashboardPath,
  routePathFor,
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

  it('builds safe paths and rejects routes outside the dashboard', () => {
    expect(routePathFor('ruta norte')).toBe('/rutas/ruta%20norte')
    expect(vanPathFor('van/01')).toBe('/furgoneta/van%2F01')
    expect(dashboardLocationForPath('/ajustes/whatsapp')).toEqual({ section: 'whatsapp-test' })
    expect(isDashboardPath('/rutas/ruta%20norte')).toBe(true)
    expect(isDashboardPath('/acceso')).toBe(false)
  })
})
