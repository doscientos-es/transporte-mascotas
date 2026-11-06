import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { DailyRoute, RouteTemplate } from '@/shared/types'

import { RoutesCatalogPage, RoutesPage } from './routes-page'

describe('RoutesCatalogPage filters', () => {
  it('labels the status and sort selects for assistive technology', () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(RoutesCatalogPage, { routes: [], templates: [], onSelect: vi.fn() }),
      ),
    )

    expect(markup).toContain('aria-label="Filtrar por estado"')
    expect(markup).toContain('aria-label="Ordenar rutas por fecha"')
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
          alias: 'Clínica Sol',
          place: 'Entrada principal',
          mapUrl: '',
          latitude: 40,
          longitude: -3,
          minutes: 35,
          kind: 'recogida',
          dwellMinutes: 10,
        },
        {
          id: 'stop-2',
          locality: 'Madrid',
          place: '',
          mapUrl: '',
          latitude: 40,
          longitude: -3,
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
          onUpdateDate: async () => {},
          onSuggestStop: async () => ({ index: 0, stops: [] }),
          onAddStop: async () => {},
          onRemoveStop: async () => {},
          onUpdateService: vi.fn(),
          onRemoveLetter: vi.fn(),
          onCancelLetter: vi.fn(),
          onCloseRoute: async () => {},
          canManage: true,
        }),
      ),
    )

    expect(markup).toContain('Añadir parada')
    expect(markup).toContain('Editar ruta')
    expect(markup).not.toContain('Reordenar paradas')
    expect(markup).not.toContain('Recalcular tiempos')
    expect(markup).toContain('Más acciones')
    expect(markup).toContain('Trayecto a Madrid')
    expect(markup).toContain('35 min')
    expect(markup).toContain('<p>Clínica Sol · Entrada principal</p>')
    expect(markup).toContain('Fin de ruta')
    expect(markup).toContain('Salida')
    expect(markup).toContain('Duración estimada')
    expect(markup).not.toContain('type="date"')
    expect(markup).not.toContain('Trayecto sig.')
    expect(markup.indexOf('class="journey-place"')).toBeLessThan(
      markup.indexOf('class="journey-leg"'),
    )
    expect(markup.indexOf('class="journey-leg"')).toBeLessThan(
      markup.lastIndexOf('class="journey-place"'),
    )
  })
})

describe('route pickup actions', () => {
  it.each([true, false])('only lets managers remove a whole pickup (manager: %s)', (canManage) => {
    const stops = ['Origen', 'Destino'].map((locality, index) => ({
      id: `stop-${index}`,
      locality,
      place: '',
      mapUrl: '',
      latitude: 40,
      longitude: -3,
      minutes: 0,
      kind: 'parada' as const,
      dwellMinutes: 15,
    }))
    const actions = (['recogida', 'entrega'] as const).flatMap((type, index) =>
      ['animal-1', 'animal-2'].map((animalId) => ({
        id: `${type}-${animalId}`,
        letterId: 'letter-1',
        animalId,
        type,
        stop: stops[index].locality,
        stopId: stops[index].id,
        customer: 'Cliente',
        phone: '600000000',
        status: 'pendiente' as const,
        box: 13,
      })),
    )
    const route: DailyRoute = {
      id: 'route-1',
      templateId: 'template-1',
      date: '2026-12-01',
      status: 'activa',
      actions,
      stops,
    }
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(RoutesPage, {
          route,
          template: { id: 'template-1', name: 'Ruta', color: '', stops: [] },
          letters: [],
          onBack: vi.fn(),
          onAction: vi.fn(),
          onUpdateStops: vi.fn(),
          onSuggestStop: vi.fn(),
          onAddStop: vi.fn(),
          onRemoveStop: vi.fn(),
          onUpdateService: vi.fn(),
          onRemoveLetter: vi.fn(),
          onCancelLetter: vi.fn(),
          onCloseRoute: vi.fn(),
          canManage,
        }),
      ),
    )
    expect(markup).not.toContain('>Recogido</button>')
    expect(markup).toContain('>Entregado</button>')
    expect(markup).toContain('1 transporte')
    expect(markup.includes('>Quitar de la ruta</button>')).toBe(canManage)
    expect(markup.includes('>Anular</button>')).toBe(canManage)
  })
})
