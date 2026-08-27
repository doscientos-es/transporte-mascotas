import type { DailyRouteStop } from './types'

type PhotonFeature = { geometry?: { coordinates?: [number, number] }; properties?: { street?: string; name?: string; postcode?: string } }
type OsrmRoute = { legs?: Array<{ duration?: number }> }
type OsrmTable = { code?: string; durations?: Array<Array<number | null>> }

function addressFor(stop: DailyRouteStop) {
  return [
    [stop.street, stop.streetNumber].filter(Boolean).join(' '),
    stop.postalCode,
    stop.locality,
    stop.province,
    stop.country || 'España',
  ].filter(Boolean).join(', ')
}

function normalized(value: string | undefined) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/\b(calle|carrer|avenida|avda|av)\b/g, '').replace(/[^a-z0-9]/g, '')
}

async function coordinatesFor(stop: DailyRouteStop) {
  const street = [stop.street, stop.streetNumber].filter(Boolean).join(' ')
  const queries = [
    addressFor(stop),
    [street, stop.locality, stop.country || 'España'].filter(Boolean).join(', '),
    [stop.postalCode, stop.locality, stop.province, stop.country || 'España'].filter(Boolean).join(', '),
    [stop.locality, stop.province, stop.country || 'España'].filter(Boolean).join(', '),
  ].filter((query, index, values) => query && values.indexOf(query) === index)

  for (const query of queries) {
    const params = new URLSearchParams({ q: query, limit: '5' })
    const response = await fetch(`https://photon.komoot.io/api/?${params}`)
    if (!response.ok) continue
    const result = await response.json() as { features?: PhotonFeature[] }
    const features = result.features ?? []
    const coordinates = features
      .toSorted((left, right) => {
        const score = (feature: PhotonFeature) => Number(normalized(feature.properties?.street ?? feature.properties?.name).includes(normalized(stop.street))) * 2 + Number(feature.properties?.postcode === stop.postalCode)
        return score(right) - score(left)
      })
      .find((feature) => feature.geometry?.coordinates?.length === 2)?.geometry?.coordinates
    if (coordinates) return coordinates
  }
  throw new Error(`No se ha podido localizar ${stop.locality}.`)
}

async function coordinatesForStops(stops: DailyRouteStop[]) {
  const coordinates: Array<[number, number]> = []
  // Requests are deliberately sequential to respect the public geocoding service.
  for (const stop of stops) coordinates.push(await coordinatesFor(stop))
  return coordinates
}

function minutesFor(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) throw new Error('No se han podido calcular los trayectos en coche.')
  return Math.max(1, Math.round(seconds / 60))
}

/** Calculates consecutive driving legs; the final stop has no following journey. */
export async function calculateDrivingTimes(stops: DailyRouteStop[]) {
  if (stops.length < 2) return stops.map((stop) => ({ ...stop, minutes: 0 }))

  const coordinates = await coordinatesForStops(stops)
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates.map(([longitude, latitude]) => `${longitude},${latitude}`).join(';')}?overview=false&steps=false`)
  if (!response.ok) throw new Error('No se han podido calcular los trayectos en coche.')
  const result = await response.json() as { code?: string; routes?: OsrmRoute[] }
  const legs = result.routes?.[0]?.legs
  if (result.code !== 'Ok' || !legs || legs.length !== stops.length - 1) throw new Error('No se han podido calcular los trayectos en coche.')

  return stops.map((stop, index) => ({
    ...stop,
    minutes: index === stops.length - 1 ? 0 : minutesFor(legs[index].duration),
  }))
}

/** Finds the insertion point with the shortest total driving time for the marked stops. */
export async function findBestStopInsertion(stops: DailyRouteStop[], newStop: DailyRouteStop) {
  if (!stops.length) return { index: 0, stops: [{ ...newStop, minutes: 0 }] }

  const allStops = [...stops, newStop]
  const coordinates = await coordinatesForStops(allStops)
  const response = await fetch(`https://router.project-osrm.org/table/v1/driving/${coordinates.map(([longitude, latitude]) => `${longitude},${latitude}`).join(';')}?annotations=duration`)
  if (!response.ok) throw new Error('No se ha podido proponer la posición de la parada.')
  const result = await response.json() as OsrmTable
  const durations = result.durations
  if (result.code !== 'Ok' || !durations?.length) throw new Error('No se ha podido proponer la posición de la parada.')

  const duration = (from: DailyRouteStop, to: DailyRouteStop) => minutesFor(durations[allStops.findIndex((stop) => stop.id === from.id)]?.[allStops.findIndex((stop) => stop.id === to.id)])
  const candidates = Array.from({ length: stops.length + 1 }, (_, index) => {
    const candidate = [...stops.slice(0, index), newStop, ...stops.slice(index)]
    const timedStops = candidate.map((stop, stopIndex) => ({ ...stop, minutes: stopIndex === candidate.length - 1 ? 0 : duration(stop, candidate[stopIndex + 1]) }))
    return { index, stops: timedStops, totalMinutes: timedStops.reduce((total, stop) => total + stop.minutes, 0) }
  })
  return candidates.reduce((best, candidate) => candidate.totalMinutes < best.totalMinutes ? candidate : best)
}
