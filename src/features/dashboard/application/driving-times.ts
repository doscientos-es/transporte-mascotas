import type { DailyRouteStop } from '@/shared/types'

import {
  googleDurationMatrix,
  googleRouteLegs,
  type GoogleLeg,
} from '../infrastructure/google-route-times'

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] }
  properties?: { street?: string; name?: string; postcode?: string }
}
type OsrmRoute = { legs?: Array<{ duration?: number }> }
type OsrmTable = { code?: string; durations?: Array<Array<number | null>> }
type ValhallaRoute = { trip?: { legs?: Array<{ summary?: { time?: number } }> } }
type ValhallaMatrix = { sources_to_targets?: Array<Array<{ time?: number | null }>> }
type Coordinates = [number, number]
type Seconds = number | null | undefined

const valhallaUrl = 'https://valhalla1.openstreetmap.de'
const osrmUrl = 'https://router.project-osrm.org'
// Valhalla (OpenStreetMap data, no API key) models road class and turns and is the primary source.
// OSRM is only the fallback: its car profile runs about 7% slower than real driving.
const osrmTimeFactor = 0.93
const maxCoordinateCacheEntries = 200
const coordinatesByAddress = new Map<string, Promise<Coordinates>>()

function addressFor(stop: DailyRouteStop) {
  return [
    [stop.street, stop.streetNumber].filter(Boolean).join(' '),
    stop.postalCode,
    stop.locality,
    stop.province,
    stop.country || 'España',
  ]
    .filter(Boolean)
    .join(', ')
}

function normalized(value: string | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/\b(calle|carrer|avenida|avda|av)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function coordinateCacheKey(stop: DailyRouteStop) {
  const savedCoordinates = savedCoordinatesFor(stop)
  if (savedCoordinates) return savedCoordinates.join(',')
  return addressFor(stop).toLocaleLowerCase()
}

function savedCoordinatesFor(stop: DailyRouteStop): Coordinates | undefined {
  const { latitude, longitude } = stop
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  )
    return undefined
  return [longitude, latitude]
}

async function resolveCoordinates(stop: DailyRouteStop) {
  const savedCoordinates = savedCoordinatesFor(stop)
  if (savedCoordinates) return savedCoordinates

  const street = [stop.street, stop.streetNumber].filter(Boolean).join(' ')
  const queries = [
    addressFor(stop),
    [street, stop.locality, stop.country || 'España'].filter(Boolean).join(', '),
    [stop.postalCode, stop.locality, stop.province, stop.country || 'España']
      .filter(Boolean)
      .join(', '),
    [stop.locality, stop.province, stop.country || 'España'].filter(Boolean).join(', '),
  ].filter((query, index, values) => query && values.indexOf(query) === index)

  for (const query of queries) {
    const params = new URLSearchParams({ q: query, limit: '5' })
    const response = await fetch(`https://photon.komoot.io/api/?${params}`)
    if (!response.ok) continue
    const result = (await response.json()) as { features?: PhotonFeature[] }
    const features = result.features ?? []
    const coordinates = features
      .toSorted((left, right) => {
        const score = (feature: PhotonFeature) =>
          Number(
            normalized(feature.properties?.street ?? feature.properties?.name).includes(
              normalized(stop.street),
            ),
          ) *
            2 +
          Number(feature.properties?.postcode === stop.postalCode)
        return score(right) - score(left)
      })
      .find((feature) => feature.geometry?.coordinates?.length === 2)?.geometry?.coordinates
    if (coordinates) return coordinates
  }
  throw new Error(`No se ha podido localizar ${stop.locality}.`)
}

function coordinatesFor(stop: DailyRouteStop) {
  const key = coordinateCacheKey(stop)
  const cached = coordinatesByAddress.get(key)
  if (cached) return cached

  const request = resolveCoordinates(stop).catch((error: unknown) => {
    coordinatesByAddress.delete(key)
    throw error
  })
  coordinatesByAddress.set(key, request)
  if (coordinatesByAddress.size > maxCoordinateCacheEntries) {
    const oldestKey = coordinatesByAddress.keys().next().value
    if (oldestKey) coordinatesByAddress.delete(oldestKey)
  }
  return request
}

/** What a calculation is doing right now, so the UI can tell the user instead of a bare spinner. */
export type DrivingProgress =
  | { phase: 'locating'; done: number; total: number }
  | { phase: 'google' }
  /** Google did not answer; a free, less precise service is being used instead. */
  | { phase: 'fallback' }
  /** Reported by the caller once the calculation is done and the result is being stored. */
  | { phase: 'saving' }

export type DrivingProgressHandler = (progress: DrivingProgress) => void

async function coordinatesForStops(stops: DailyRouteStop[], onProgress?: DrivingProgressHandler) {
  const coordinates: Coordinates[] = []
  onProgress?.({ phase: 'locating', done: 0, total: stops.length })
  // Requests are deliberately sequential to respect the public geocoding service.
  for (const stop of stops) {
    coordinates.push(await coordinatesFor(stop))
    onProgress?.({ phase: 'locating', done: coordinates.length, total: stops.length })
  }
  return coordinates
}

function minutesFor(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds))
    throw new Error('No se han podido calcular los trayectos en coche.')
  return Math.max(1, Math.round(seconds / 60))
}

const isSeconds = (value: Seconds): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const toLocation = ([lon, lat]: Coordinates) => ({ lon, lat })
const toOsrmPath = (coordinates: Coordinates[]) =>
  coordinates.map(([lon, lat]) => lon + ',' + lat).join(';')

// The public server allows one request per second per user; requests are queued to respect it.
const valhallaMinGapMs = 1100
const valhallaTimeoutMs = 8000
let valhallaQueue: Promise<unknown> = Promise.resolve()
let lastValhallaRequestAt = 0

function throttledValhalla<T>(task: () => Promise<T>) {
  const run = valhallaQueue.then(async () => {
    const wait = lastValhallaRequestAt + valhallaMinGapMs - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastValhallaRequestAt = Date.now()
    return task()
  })
  valhallaQueue = run.catch(() => undefined)
  return run
}

function valhallaPost<T>(path: string, body: object) {
  return throttledValhalla(async () => {
    const response = await fetch(valhallaUrl + '/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'kache-envios' },
      body: JSON.stringify({ costing: 'auto', ...body }),
      signal: AbortSignal.timeout(valhallaTimeoutMs),
    })
    if (!response.ok) throw new Error('Valhalla ' + response.status)
    return (await response.json()) as T
  })
}

export type DrivingSource = 'google' | 'valhalla' | 'osrm'

export type DrivingLeg = {
  /** Driving minutes, rounded up to at least 1. */
  minutes: number
  /** Road distance; only Google reports it. */
  meters?: number
  /** The road driven, as `[latitude, longitude]` pairs; only Google reports it. */
  path?: Array<[latitude: number, longitude: number]>
}

/** How a set of driving legs was calculated, so the UI can show where the numbers come from. */
export type RouteVerification = {
  source: DrivingSource
  calculatedAt: number
  legs: DrivingLeg[]
}

const toVerification = (legs: GoogleLeg[]): RouteVerification => ({
  source: 'google',
  calculatedAt: Date.now(),
  legs: legs.map((leg) => ({
    minutes: minutesFor(leg.seconds),
    ...(leg.meters === null ? {} : { meters: leg.meters }),
    ...(leg.path.length >= 2 ? { path: leg.path } : {}),
  })),
})

/** Driving legs for each consecutive pair of coordinates, with the source that answered. */
async function routeLegs(
  coordinates: Coordinates[],
  onProgress?: DrivingProgressHandler,
): Promise<{ source: DrivingSource; seconds: Seconds[]; google?: GoogleLeg[] }> {
  // Google is the most precise source; the free services below only cover for it.
  onProgress?.({ phase: 'google' })
  const fromGoogle = await googleRouteLegs(coordinates)
  if (fromGoogle)
    return { source: 'google', seconds: fromGoogle.map((leg) => leg.seconds), google: fromGoogle }
  onProgress?.({ phase: 'fallback' })

  const fromValhalla = await valhallaPost<ValhallaRoute>('route', {
    locations: coordinates.map(toLocation),
  })
    .then((result) => result.trip?.legs?.map((leg) => leg.summary?.time))
    .catch(() => undefined)
  if (fromValhalla?.length === coordinates.length - 1 && fromValhalla.every(isSeconds))
    return { source: 'valhalla', seconds: fromValhalla }

  const response = await fetch(
    osrmUrl + '/route/v1/driving/' + toOsrmPath(coordinates) + '?overview=false&steps=false',
  )
  if (!response.ok) throw new Error('No se han podido calcular los trayectos en coche.')
  const result = (await response.json()) as { code?: string; routes?: OsrmRoute[] }
  const legs = result.routes?.[0]?.legs
  if (result.code !== 'Ok' || !legs || legs.length !== coordinates.length - 1)
    throw new Error('No se han podido calcular los trayectos en coche.')
  return {
    source: 'osrm',
    seconds: legs.map((leg) =>
      isSeconds(leg.duration) ? leg.duration * osrmTimeFactor : undefined,
    ),
  }
}

/** Driving seconds between every pair of coordinates. */
async function durationMatrix(
  coordinates: Coordinates[],
  onProgress?: DrivingProgressHandler,
): Promise<Seconds[][]> {
  onProgress?.({ phase: 'google' })
  const fromGoogle = await googleDurationMatrix(coordinates)
  if (fromGoogle) return fromGoogle
  onProgress?.({ phase: 'fallback' })

  const locations = coordinates.map(toLocation)
  const fromValhalla = await valhallaPost<ValhallaMatrix>('sources_to_targets', {
    sources: locations,
    targets: locations,
  })
    .then((result) => result.sources_to_targets?.map((row) => row.map((cell) => cell.time)))
    .catch(() => undefined)
  if (fromValhalla?.length === coordinates.length) return fromValhalla

  const response = await fetch(
    osrmUrl + '/table/v1/driving/' + toOsrmPath(coordinates) + '?annotations=duration',
  )
  if (!response.ok) throw new Error('No se ha podido proponer la posición de la parada.')
  const result = (await response.json()) as OsrmTable
  const durations = result.durations
  if (result.code !== 'Ok' || !durations?.length)
    throw new Error('No se ha podido proponer la posición de la parada.')
  return durations.map((row) =>
    row.map((value) => (isSeconds(value) ? value * osrmTimeFactor : value)),
  )
}

/**
 * Calculates consecutive driving legs; the final stop has no following journey. Also reports
 * which service answered and, for Google, the distance and road of every leg.
 */
export async function calculateDrivingRoute(
  stops: DailyRouteStop[],
  onProgress?: DrivingProgressHandler,
) {
  if (stops.length < 2)
    return {
      stops: stops.map((stop) => ({ ...stop, minutes: 0 })),
      verification: undefined as RouteVerification | undefined,
    }

  const coordinates = await coordinatesForStops(stops, onProgress)
  const { source, seconds, google } = await routeLegs(coordinates, onProgress)
  const verification: RouteVerification = google
    ? toVerification(google)
    : {
        source,
        calculatedAt: Date.now(),
        legs: seconds.slice(0, stops.length - 1).map((value) => ({ minutes: minutesFor(value) })),
      }

  return {
    stops: stops.map((stop, index) => ({
      ...stop,
      minutes: index === stops.length - 1 ? 0 : minutesFor(seconds[index]),
    })),
    verification,
  }
}

export async function calculateDrivingTimes(
  stops: DailyRouteStop[],
  onProgress?: DrivingProgressHandler,
) {
  return (await calculateDrivingRoute(stops, onProgress)).stops
}

const maxVerificationCacheEntries = 20
const verificationsByRoute = new Map<string, Promise<RouteVerification | null>>()

/**
 * Asks Google for the legs of a route without changing anything, to compare them with the
 * saved times and draw the real road. Resolves to `null` when Google is unavailable (the free
 * services are never used here). Answers are kept for the session so reopening a route does
 * not bill Google again.
 */
export function verifyDrivingRoute(stops: DailyRouteStop[], onProgress?: DrivingProgressHandler) {
  if (stops.length < 2) return Promise.resolve(null)
  const key = stops.map(coordinateCacheKey).join(';')
  const cached = verificationsByRoute.get(key)
  if (cached) return cached

  const request = coordinatesForStops(stops, onProgress)
    .then((coordinates) => {
      onProgress?.({ phase: 'google' })
      return googleRouteLegs(coordinates)
    })
    .then((legs) => (legs ? toVerification(legs) : null))
    .catch(() => null)
  verificationsByRoute.set(key, request)
  void request.then((result) => {
    if (!result) verificationsByRoute.delete(key)
  })
  if (verificationsByRoute.size > maxVerificationCacheEntries) {
    const oldestKey = verificationsByRoute.keys().next().value
    if (oldestKey) verificationsByRoute.delete(oldestKey)
  }
  return request
}

/** Finds the insertion point with the shortest total driving time for the marked stops. */
export async function findBestStopInsertion(
  stops: DailyRouteStop[],
  newStop: DailyRouteStop,
  onProgress?: DrivingProgressHandler,
) {
  if (!stops.length) return { index: 0, stops: [{ ...newStop, minutes: 0 }] }

  const allStops = [...stops, newStop]
  const coordinates = await coordinatesForStops(allStops, onProgress)
  const durations = await durationMatrix(coordinates, onProgress)

  const duration = (from: DailyRouteStop, to: DailyRouteStop) =>
    minutesFor(
      durations[allStops.findIndex((stop) => stop.id === from.id)]?.[
        allStops.findIndex((stop) => stop.id === to.id)
      ],
    )
  const candidates = Array.from({ length: stops.length + 1 }, (_, index) => {
    const candidate = [...stops.slice(0, index), newStop, ...stops.slice(index)]
    const timedStops = candidate.map((stop, stopIndex) => ({
      ...stop,
      minutes: stopIndex === candidate.length - 1 ? 0 : duration(stop, candidate[stopIndex + 1]),
    }))
    return {
      index,
      stops: timedStops,
      totalMinutes: timedStops.reduce((total, stop) => total + stop.minutes, 0),
    }
  })
  return candidates.reduce((best, candidate) =>
    candidate.totalMinutes < best.totalMinutes ? candidate : best,
  )
}
