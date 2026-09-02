import { describe, expect, it } from 'vitest'

import type { RouteTemplate } from '@/shared/types'

import { dailyRouteStopsForTemplate } from './daily-route-stops'

const template: RouteTemplate = {
  id: 'norte',
  name: 'Ruta norte',
  color: '#000',
  stops: ['Madrid', 'Zaragoza', 'Barcelona'].map((locality, index) => ({
    id: String(index),
    locality,
    place: '',
    mapUrl: '',
    minutes: 0,
  })),
}

describe('dailyRouteStopsForTemplate', () => {
  it('copies only the marked stops while preserving their itinerary order', () => {
    expect(
      dailyRouteStopsForTemplate(template, 'normal', ['0', '2']).map((stop) => stop.locality),
    ).toEqual(['Madrid', 'Barcelona'])
  })

  it('applies the selected itinerary in reverse when requested', () => {
    expect(
      dailyRouteStopsForTemplate(template, 'inversa', ['0', '2']).map((stop) => stop.locality),
    ).toEqual(['Barcelona', 'Madrid'])
  })
})
