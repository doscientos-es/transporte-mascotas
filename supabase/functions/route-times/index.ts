import { corsHeaders, json, requireAdmin } from '../_shared/supabase.ts'

type Point = { lat: number; lng: number }

// Compute Routes stays in the cheap "Essentials" SKU (no traffic, at most 10 intermediate
// waypoints per request), so a long route is split into windows that share their end stop.
const POINTS_PER_REQUEST = 12
const MAX_POINTS = 120

const waypoint = ({ lat, lng }: Point) => ({
  location: { latLng: { latitude: lat, longitude: lng } },
})

function isPoint(value: unknown): value is Point {
  const point = value as Point
  return (
    Number.isFinite(point?.lat) &&
    Number.isFinite(point?.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  )
}

type Leg = { seconds: number; meters: number | null; polyline: string | null }

async function legDetails(points: Point[], apiKey: string): Promise<Leg[]> {
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      // Duration, distance and drawn road of each leg. The polyline does not change the SKU.
      'X-Goog-FieldMask':
        'routes.legs.duration,routes.legs.distanceMeters,routes.legs.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: waypoint(points[0]),
      destination: waypoint(points[points.length - 1]),
      intermediates: points.slice(1, -1).map(waypoint),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      units: 'METRIC',
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Google Routes ${response.status}`)
  const body = (await response.json()) as {
    routes?: Array<{
      legs?: Array<{
        duration?: string
        distanceMeters?: number
        polyline?: { encodedPolyline?: string }
      }>
    }>
  }
  const legs = body.routes?.[0]?.legs
  if (!legs || legs.length !== points.length - 1) throw new Error('Google Routes sin trayecto')
  return legs.map((leg) => ({
    seconds: Number.parseFloat(leg.duration ?? ''),
    meters: Number.isFinite(leg.distanceMeters) ? (leg.distanceMeters as number) : null,
    polyline: leg.polyline?.encodedPolyline ?? null,
  }))
}

// Compute Route Matrix accepts at most 625 origin x destination elements.
const MAX_MATRIX_POINTS = 25

/** Driving seconds from every point to every other point (`null` when there is no road path). */
async function matrixSeconds(points: Point[], apiKey: string) {
  const response = await fetch(
    'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,condition',
      },
      body: JSON.stringify({
        origins: points.map((point) => ({ waypoint: waypoint(point) })),
        destinations: points.map((point) => ({ waypoint: waypoint(point) })),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
      }),
      signal: AbortSignal.timeout(15_000),
    },
  )
  if (!response.ok) throw new Error(`Google Routes ${response.status}`)
  const elements = (await response.json()) as Array<{
    originIndex?: number
    destinationIndex?: number
    duration?: string
    condition?: string
  }>
  const matrix: Array<Array<number | null>> = points.map(() => points.map(() => null))
  for (const { originIndex, destinationIndex, duration, condition } of elements) {
    if (originIndex === undefined || destinationIndex === undefined) continue
    if (condition !== 'ROUTE_EXISTS' && originIndex !== destinationIndex) continue
    const seconds = originIndex === destinationIndex ? 0 : Number.parseFloat(duration ?? '')
    if (Number.isFinite(seconds) && matrix[originIndex])
      matrix[originIndex][destinationIndex] = seconds
  }
  return matrix
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    await requireAdmin(request)
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!apiKey) return json({ error: 'Google Maps no está configurado.' }, 503)
    const { points, mode } = (await request.json()) as { points?: unknown; mode?: unknown }
    if (mode === 'matrix') {
      if (!Array.isArray(points) || points.length < 2 || points.length > MAX_MATRIX_POINTS)
        return json({ error: 'Trayecto no válido.' }, 400)
      if (!points.every(isPoint)) return json({ error: 'Coordenadas no válidas.' }, 400)
      return json({ matrix: await matrixSeconds(points, apiKey) })
    }
    if (!Array.isArray(points) || points.length < 2 || points.length > MAX_POINTS)
      return json({ error: 'Trayecto no válido.' }, 400)
    if (!points.every(isPoint)) return json({ error: 'Coordenadas no válidas.' }, 400)

    const legs: Leg[] = []
    for (let start = 0; start < points.length - 1; start += POINTS_PER_REQUEST - 1) {
      const window = points.slice(start, start + POINTS_PER_REQUEST)
      if (window.length < 2) break
      legs.push(...(await legDetails(window, apiKey)))
    }
    if (legs.length !== points.length - 1 || !legs.every((leg) => Number.isFinite(leg.seconds)))
      throw new Error('Respuesta de Google incompleta.')
    return json({ seconds: legs.map((leg) => leg.seconds), legs })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se han podido calcular los trayectos.'
    return json({ error: message }, message === 'No autenticado.' ? 401 : 502)
  }
})
