import type { RouteStop } from '@/shared/types'

export const formatDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

export function mapsEmbedUrl(latitude: number, longitude: number) {
  const delta = 0.012
  return `https://www.openstreetmap.org/export/embed.html?${new URLSearchParams({
    bbox: `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`,
    layer: 'mapnik',
    marker: `${latitude},${longitude}`,
  })}`
}

export function googleMapsDirectionsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
}

/** Directions to the exact stop when coordinates are known, otherwise to the locality. */
export function transportLocationMapsUrl(location: string, latitude?: number, longitude?: number) {
  if (typeof latitude === 'number' && typeof longitude === 'number')
    return googleMapsDirectionsUrl(latitude, longitude)
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination: location })}`
}

type GeoStop = RouteStop & { latitude: number; longitude: number }

function stopsWithCoordinates(stops: RouteStop[]): GeoStop[] {
  return stops.filter(
    (stop): stop is GeoStop =>
      typeof stop.latitude === 'number' && typeof stop.longitude === 'number',
  )
}

// Google Maps URLs accept at most 9 waypoints (origin + 9 + destination = 11 points).
const MAX_POINTS_PER_LINK = 11

export type ItineraryDirectionsLink = { url: string; from: number; to: number }

/**
 * Google Maps directions links covering every stop in sequence. A single link cannot hold
 * more than 11 points, so longer itineraries are split in consecutive legs that share the
 * boundary stop (the last stop of one link is the first of the next).
 */
export function itineraryDirectionsLinks(stops: RouteStop[]): ItineraryDirectionsLink[] {
  const geoStops = stopsWithCoordinates(stops)
  const links: ItineraryDirectionsLink[] = []
  for (let start = 0; start < geoStops.length - 1; start += MAX_POINTS_PER_LINK - 1) {
    const chunk = geoStops.slice(start, start + MAX_POINTS_PER_LINK)
    const first = chunk[0]
    const last = chunk[chunk.length - 1]
    const params = new URLSearchParams({
      api: '1',
      origin: `${first.latitude},${first.longitude}`,
      destination: `${last.latitude},${last.longitude}`,
    })
    if (chunk.length > 2)
      params.set(
        'waypoints',
        chunk
          .slice(1, -1)
          .map((stop) => `${stop.latitude},${stop.longitude}`)
          .join('|'),
      )
    links.push({
      url: `https://www.google.com/maps/dir/?${params}`,
      from: start + 1,
      to: start + chunk.length,
    })
  }
  return links
}
