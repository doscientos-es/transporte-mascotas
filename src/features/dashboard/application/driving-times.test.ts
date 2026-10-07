import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DailyRouteStop } from '@/shared/types'

import { calculateDrivingTimes } from './driving-times'

afterEach(() => vi.unstubAllGlobals())

describe('calculateDrivingTimes', () => {
  it('uses saved stop coordinates to calculate and estimate each driving leg', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: 'Ok', routes: [{ legs: [{ duration: 600 }] }] }), {
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const stops: DailyRouteStop[] = [
      {
        id: 'stop-1',
        locality: 'Barcelona',
        place: '',
        mapUrl: '',
        minutes: 0,
        kind: 'parada',
        dwellMinutes: 15,
        latitude: 41.3,
        longitude: 2.1,
      },
      {
        id: 'stop-2',
        locality: 'Badalona',
        place: '',
        mapUrl: '',
        minutes: 0,
        kind: 'parada',
        dwellMinutes: 15,
        latitude: 41.4,
        longitude: 2.2,
      },
    ]

    const updatedStops = await calculateDrivingTimes(stops)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/driving/2.1,41.3;2.2,41.4?')
    expect(updatedStops.map((stop) => stop.minutes)).toEqual([13, 0])
  })
})
