import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { UpcomingRoute } from '@/shared/types'

import { UpcomingRouteCard } from './upcoming-route-card'

const route: UpcomingRoute = {
  id: 'route-north',
  serviceDate: '2026-10-06',
  routeDirection: 'normal',
  templateName: 'Norte',
  templateColor: '#cf1f2a',
  localities: ['Pozoblanco', 'Madrid', 'Burgos'],
  stops: ['Pozoblanco', 'Madrid', 'Burgos'].map((locality, index) => ({
    id: `stop-${index + 1}`,
    locality,
    place: locality,
    mapUrl: '',
    minutes: 0,
  })),
}

describe('UpcomingRouteCard', () => {
  it('shows the route date, itinerary, stop count, and clear actions', () => {
    const markup = renderToStaticMarkup(
      createElement(UpcomingRouteCard, {
        route,
        onDetails: vi.fn(),
        onSelect: vi.fn(),
      }),
    )

    expect(markup).toContain('aria-label="Salida el')
    expect(markup).toContain('Norte')
    expect(markup).toContain('Pozoblanco · Madrid · Burgos')
    expect(markup).toContain('3 paradas')
    expect(markup).toContain('Ver recorrido')
    expect(markup).toContain('Solicitar transporte')
  })
})
