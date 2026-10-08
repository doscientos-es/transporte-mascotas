import { describe, expect, it } from 'vitest'

import type { DailyRouteStop } from '@/shared/types'

import { findForwardRouteSegment } from './route-segment'

const stops = ['Madrid', 'Valencia', 'Madrid'].map((locality, index): DailyRouteStop => ({
  id: String(index),
  locality,
  place: '',
  mapUrl: '',
  minutes: 0,
  kind: 'parada',
  dwellMinutes: 15,
}))

describe('findForwardRouteSegment', () => {
  it('uses the first segment that follows the itinerary', () => {
    expect(findForwardRouteSegment(stops, ' madrid ', 'Madrid')).toEqual({
      originStop: stops[0],
      destinationStop: stops[2],
    })
  })

  it('rejects a journey that only exists in reverse order', () => {
    expect(findForwardRouteSegment(stops.slice(0, 2), 'Valencia', 'Madrid')).toBeNull()
  })

  it('uses the selected occurrence when a locality repeats', () => {
    expect(findForwardRouteSegment(stops, 'Madrid', 'Madrid', '0', '2')).toEqual({
      originStop: stops[0],
      destinationStop: stops[2],
    })
    expect(findForwardRouteSegment(stops, 'Madrid', 'Valencia', '2', '1')).toBeNull()
  })
})
