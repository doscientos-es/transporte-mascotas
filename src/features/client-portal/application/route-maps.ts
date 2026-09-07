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

type GeoStop = RouteStop & { latitude: number; longitude: number }

function stopsWithCoordinates(stops: RouteStop[]): GeoStop[] {
  return stops.filter(
    (stop): stop is GeoStop =>
      typeof stop.latitude === 'number' && typeof stop.longitude === 'number',
  )
}

/** Embed URL for a map showing the bounding box that covers every stop of the itinerary. */
export function itineraryEmbedUrl(stops: RouteStop[]) {
  const geoStops = stopsWithCoordinates(stops)
  if (!geoStops.length) return null
  const lats = geoStops.map((stop) => stop.latitude)
  const lngs = geoStops.map((stop) => stop.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const latPad = Math.max((maxLat - minLat) * 0.15, 0.01)
  const lngPad = Math.max((maxLng - minLng) * 0.15, 0.01)
  return `https://www.openstreetmap.org/export/embed.html?${new URLSearchParams({
    bbox: `${minLng - lngPad},${minLat - latPad},${maxLng + lngPad},${maxLat + latPad}`,
    layer: 'mapnik',
    marker: `${geoStops[0].latitude},${geoStops[0].longitude}`,
  })}`
}

/** Google Maps directions URL following every stop of the itinerary in sequence. */
export function itineraryDirectionsUrl(stops: RouteStop[]) {
  const geoStops = stopsWithCoordinates(stops)
  if (geoStops.length < 2) return null
  const first = geoStops[0]
  const last = geoStops[geoStops.length - 1]
  const waypoints = geoStops.slice(1, -1)
  const params = new URLSearchParams({
    api: '1',
    origin: `${first.latitude},${first.longitude}`,
    destination: `${last.latitude},${last.longitude}`,
  })
  if (waypoints.length)
    params.set('waypoints', waypoints.map((stop) => `${stop.latitude},${stop.longitude}`).join('|'))
  return `https://www.google.com/maps/dir/?${params}`
}
