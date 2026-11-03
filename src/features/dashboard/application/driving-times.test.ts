import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DailyRouteStop } from '@/shared/types'

import { googleDurationMatrix, googleRouteLegs } from '../infrastructure/google-route-times'
import {
  calculateDrivingRoute,
  calculateDrivingTimes,
  findBestStopInsertion,
  verifyDrivingRoute,
} from './driving-times'
import { decodePolyline } from './encoded-polyline'
import { legLabel, summarizeVerification } from './route-verification'

vi.mock('../infrastructure/google-route-times', () => ({
  googleRouteLegs: vi.fn().mockResolvedValue(null),
  googleDurationMatrix: vi.fn().mockResolvedValue(null),
}))

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

describe('calculateDrivingTimes with Google', () => {
  it('uses the Google durations and never calls the free services', async () => {
    vi.mocked(googleRouteLegs).mockResolvedValueOnce([{ seconds: 5400, meters: 80000, path: [] }])
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    const updatedStops = await calculateDrivingTimes([
      stop('stop-1', 41.3, 2.1),
      stop('stop-2', 41.4, 2.2),
    ])

    expect(googleRouteLegs).toHaveBeenCalledWith([
      [2.1, 41.3],
      [2.2, 41.4],
    ])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(updatedStops.map((item) => item.minutes)).toEqual([90, 0])
  })
})

describe('route verification', () => {
  const path: Array<[number, number]> = [
    [41.3, 2.1],
    [41.35, 2.15],
    [41.4, 2.2],
  ]

  it('reports Google as the source with the distance and road of each leg', async () => {
    vi.mocked(googleRouteLegs).mockResolvedValueOnce([{ seconds: 5400, meters: 80000, path }])

    const result = await calculateDrivingRoute([
      stop('stop-1', 41.3, 2.1),
      stop('stop-2', 41.4, 2.2),
    ])

    expect(result.verification).toMatchObject({
      source: 'google',
      legs: [{ minutes: 90, meters: 80000, path }],
    })
  })

  it('reports the free service that answered when Google is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({ trip: { legs: [{ summary: { time: 600 } }] } })),
    )

    const result = await calculateDrivingRoute([
      stop('stop-1', 41.3, 2.1),
      stop('stop-2', 41.4, 2.2),
    ])

    expect(result.verification?.source).toBe('valhalla')
    expect(result.verification?.legs[0]).toEqual({ minutes: 10 })
  })

  it('verifies with Google only, and asks again only after a failure', async () => {
    const stops = [stop('v-1', 42.3, 3.1), stop('v-2', 42.4, 3.2)]
    vi.mocked(googleRouteLegs).mockClear()
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    expect(await verifyDrivingRoute(stops)).toBeNull()
    vi.mocked(googleRouteLegs).mockResolvedValueOnce([{ seconds: 600, meters: 9000, path }])
    const verified = await verifyDrivingRoute(stops)
    expect(verified?.source).toBe('google')
    expect(await verifyDrivingRoute(stops)).toBe(verified)

    expect(googleRouteLegs).toHaveBeenCalledTimes(2)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports each phase, and flags when Google is replaced by a free service', async () => {
    const stops = [stop('p-1', 43.3, 4.1), stop('p-2', 43.4, 4.2)]
    vi.mocked(googleRouteLegs).mockResolvedValueOnce([{ seconds: 600, meters: 9000, path }])
    const withGoogle: string[] = []
    await calculateDrivingRoute(stops, (progress) => withGoogle.push(progress.phase))
    expect(withGoogle).toEqual(['locating', 'locating', 'locating', 'google'])

    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({ trip: { legs: [{ summary: { time: 600 } }] } })),
    )
    const withFallback: string[] = []
    await calculateDrivingRoute(stops, (progress) => withFallback.push(progress.phase))
    expect(withFallback.slice(-2)).toEqual(['google', 'fallback'])
  })

  it('decodes a Google encoded polyline', () => {
    // Example from Google's polyline algorithm documentation.
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ])
  })

  it('treats small gaps as a match and flags real differences', () => {
    const verification = {
      source: 'google' as const,
      calculatedAt: 0,
      legs: [
        { minutes: 40, meters: 30000 },
        { minutes: 62, meters: 70500 },
      ],
    }

    const close = summarizeVerification(verification, [41, 60])
    expect(close).toMatchObject({ googleMinutes: 102, savedMinutes: 101, matches: true })
    expect(close?.kilometers).toBeCloseTo(100.5)

    const far = summarizeVerification(verification, [20, 30])
    expect(far).toMatchObject({ differenceMinutes: 52, matches: false })
    expect(summarizeVerification(verification, [20])).toBeNull()
  })

  it('does not verify a route when wrong leg times cancel out in the total', () => {
    const verification = {
      source: 'google' as const,
      calculatedAt: 0,
      legs: [{ minutes: 40 }, { minutes: 60 }],
    }

    expect(summarizeVerification(verification, [70, 30])).toMatchObject({
      googleMinutes: 100,
      savedMinutes: 100,
      differenceMinutes: 0,
      matches: false,
    })
    expect(summarizeVerification(verification, [70, 32])?.matches).toBe(false)
  })

  it('does not let small errors on many legs hide a significant total difference', () => {
    const verification = {
      source: 'google' as const,
      calculatedAt: 0,
      legs: Array.from({ length: 5 }, () => ({ minutes: 10 })),
    }

    expect(summarizeVerification(verification, [12, 12, 12, 12, 12])?.matches).toBe(false)
  })

  it('labels a leg with its time and distance', () => {
    expect(legLabel({ minutes: 18, meters: 14200 })).toBe('18 min · 14 km')
    expect(legLabel({ minutes: 95, meters: 8500 })).toBe('1 h 35 min · 8,5 km')
    expect(legLabel({ minutes: 7 })).toBe('7 min')
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

  it('uses the Google matrix and never calls the free services', async () => {
    vi.mocked(googleDurationMatrix).mockResolvedValueOnce([
      [0, 600, 1200],
      [600, 0, 300],
      [1200, 300, 0],
    ])
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    const best = await findBestStopInsertion(
      [stop('a', 41.3, 2.1), stop('b', 41.4, 2.2)],
      stop('c', 41.5, 2.3),
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(best.index).toBe(2)
    expect(best.stops.map((item) => item.minutes)).toEqual([10, 5, 0])
  })
})
