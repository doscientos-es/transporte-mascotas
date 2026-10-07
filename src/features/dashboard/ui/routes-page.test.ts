import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { DailyRoute, RouteTemplate } from '@/shared/types'

import { RoutesCatalogPage, RoutesPage } from './routes-page'

describe('RoutesCatalogPage filters', () => {
  it('associates the status and sort labels with their native selects', () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(RoutesCatalogPage, { routes: [], templates: [], onSelect: vi.fn() }),
      ),
    )

    expect(markup).toContain('for="route-status-filter"')
    expect(markup).toContain('id="route-status-filter"')
    expect(markup).toContain('for="route-sort-direction"')
    expect(markup).toContain('id="route-sort-direction"')
  })
})

describe('RoutesPage header', () => {
  it('keeps planning actions visible and groups secondary actions in a menu', () => {
    const route: DailyRoute = {
      id: 'route-1',
      templateId: 'template-1',
      date: '2026-12-01',
      status: 'activa',
      actions: [],
      stops: [
        {
          id: 'stop-1',
          locality: 'Córdoba',
          place: '',
          mapUrl: '',
          minutes: 35,
          kind: 'recogida',
          dwellMinutes: 10,
        },
        {
          id: 'stop-2',
          locality: 'Madrid',
          place: '',
          mapUrl: '',
          minutes: 0,
          kind: 'entrega',
          dwellMinutes: 5,
        },
      ],
    }
    const template: RouteTemplate = { id: 'template-1', name: 'Completa', color: '', stops: [] }
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(RoutesPage, {
          route,
          template,
          letters: [],
          onBack: vi.fn(),
          onAction: async () => {},
          onUpdateStops: async () => {},
          onSuggestStop: async () => ({ index: 0, stops: [] }),
          onAddStop: async () => {},
          onRemoveStop: async () => {},
          onUpdateService: vi.fn(),
          onRemoveService: vi.fn(),
          onCloseRoute: async () => {},
          canManage: true,
        }),
      ),
    )

    expect(markup).toContain('Añadir parada')
    expect(markup).toContain('Reordenar paradas')
    expect(markup).toContain('Organizar paradas')
    expect(markup).toContain('Más acciones')
    expect(markup).toContain('Trayecto a Madrid')
    expect(markup).toContain('35 min')
    expect(markup).toContain('Fin de ruta')
    expect(markup).not.toContain('Trayecto sig.')
    expect(markup.indexOf('class="journey-place"')).toBeLessThan(
      markup.indexOf('class="journey-leg"'),
    )
    expect(markup.indexOf('class="journey-leg"')).toBeLessThan(
      markup.lastIndexOf('class="journey-place"'),
    )
  })
})
