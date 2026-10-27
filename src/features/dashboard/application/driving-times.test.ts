import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DailyRouteStop } from '@/shared/types'

import { calculateDrivingTimes, findBestStopInsertion } from './driving-times'

afterEach(() => vi.unstubAllGlobals())

const stop = (id: string, latitude: number, longitude: number): DailyRouteStop => ({
  id,
  locality: id,
  place: '',
  mapUrl: '',
  minutes: 0,
  kind: 'parada',
  dwellMinutes: 15,
  latitude,
  longitude,
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const requestBody = (mock: ReturnType<typeof vi.fn<typeof fetch>>, call: number) => {
  const body = mock.mock.calls[call]?.[1]?.body
  return typeof body === 'string' ? body : '{}'
}

describe('calculateDrivingTimes', () => {
  it('uses Valhalla durations as they are, with the saved stop coordinates', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ trip: { legs: [{ summary: { time: 6000 } }] } }))
    vi.stubGlobal('fetch', fetchMock)

    const updatedStops = await calculateDrivingTimes([
      stop('stop-1', 41.3, 2.1),
      stop('stop-2', 41.4, 2.2),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://valhalla1.openstreetmap.de/route')
    expect(JSON.parse(requestBody(fetchMock, 0))).toMatchObject({
      costing: 'auto',
      locations: [
        { lon: 2.1, lat: 41.3 },
        { lon: 2.2, lat: 41.4 },
      ],
    })
    expect(updatedStops.map((item) => item.minutes)).toEqual([100, 0])
  })

  it('falls back to OSRM, reduced by about 7%, when Valhalla is unavailable', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 500))
      .mockResolvedValueOnce(json({ code: 'Ok', routes: [{ legs: [{ duration: 6000 }] }] }))
    vi.stubGlobal('fetch', fetchMock)

    const updatedStops = await calculateDrivingTimes([
      stop('stop-1', 41.3, 2.1),
      stop('stop-2', 41.4, 2.2),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/driving/2.1,41.3;2.2,41.4?')
    expect(updatedStops.map((item) => item.minutes)).toEqual([93, 0])
  })
})

describe('findBestStopInsertion', () => {
  it('places the new stop where the total Valhalla driving time is shortest', async () => {
    const times = [
      [0, 600, 1200],
      [600, 0, 300],
      [1200, 300, 0],
    ]
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        json({ sources_to_targets: times.map((row) => row.map((time) => ({ time }))) }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const best = await findBestStopInsertion(
      [stop('a', 41.3, 2.1), stop('b', 41.4, 2.2)],
      stop('c', 41.5, 2.3),
    )

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://valhalla1.openstreetmap.de/sources_to_targets',
    )
    expect(best.index).toBe(2)
    expect(best.stops.map((item) => item.minutes)).toEqual([10, 5, 0])
  })
})
