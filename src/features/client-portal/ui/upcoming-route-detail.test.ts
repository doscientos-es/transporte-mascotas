import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { UpcomingRoute } from '@/shared/types'

import { UpcomingRouteDetail } from './upcoming-route-detail'

describe('UpcomingRouteDetail', () => {
  it('shows only the approximate arrival period and day for stops reached after midnight', () => {
    const route: UpcomingRoute = {
      id: 'route-north',
      serviceDate: '2026-10-06',
      startTime: '08:00',
      routeDirection: 'normal',
      templateName: 'Norte',
      templateColor: '#cf1f2a',
      localities: ['Córdoba', 'Madrid'],
      stops: [
        {
          id: 'stop-cordoba',
          locality: 'Córdoba',
          place: 'Estación',
          mapUrl: '',
          minutes: 960,
          dwellMinutes: 15,
        },
        {
          id: 'stop-madrid',
          locality: 'Madrid',
          place: 'Centro',
          mapUrl: '',
          minutes: 0,
          dwellMinutes: 0,
        },
      ],
    }
    const markup = renderToStaticMarkup(
      createElement(UpcomingRouteDetail, {
        route,
        onBack: vi.fn(),
        onSelect: vi.fn(),
      }),
    )

    expect(markup).toContain(
      'Franja aproximada: <strong>madrugada (00:00–06:00) · miércoles, 7 de octubre</strong>',
    )
    expect(markup).not.toContain('00:15')
    expect(markup).not.toContain('dateTime="2026-10-07T00:15"')
    expect(markup).toContain('Confirmaremos la hora exacta al cerrar la ruta.')
  })
})
