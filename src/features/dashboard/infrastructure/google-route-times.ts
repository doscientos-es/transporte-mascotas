import { requireSupabase } from '@/shared/infrastructure/supabase'

import { decodePolyline } from '../application/encoded-polyline'

export type GoogleLeg = {
  seconds: number
  /** Road distance; `null` when Google did not return it. */
  meters: number | null
  /** The road Google drives between both stops, as `[latitude, longitude]` pairs. */
  path: Array<[latitude: number, longitude: number]>
}

type RawLeg = { seconds?: unknown; meters?: unknown; polyline?: unknown }

function toLeg(raw: RawLeg): GoogleLeg | null {
  if (typeof raw?.seconds !== 'number' || !Number.isFinite(raw.seconds)) return null
  let path: GoogleLeg['path'] = []
  try {
    path = typeof raw.polyline === 'string' ? decodePolyline(raw.polyline) : []
  } catch {
    // A broken drawing must not discard a valid duration.
  }
  const meters = typeof raw.meters === 'number' && Number.isFinite(raw.meters) ? raw.meters : null
  return { seconds: raw.seconds, meters, path }
}

/**
 * Driving legs between consecutive points from Google Routes (duration, distance and drawn
 * road), through the admin-only `route-times` edge function (the API key never reaches the
 * browser). Resolves to `null` when Google is not configured or fails, so callers can fall
 * back to the free services.
 */
export async function googleRouteLegs(
  coordinates: Array<[longitude: number, latitude: number]>,
): Promise<GoogleLeg[] | null> {
  try {
    const { data, error } = await requireSupabase().functions.invoke('route-times', {
      body: { points: coordinates.map(([lng, lat]) => ({ lat, lng })) },
    })
    if (error) return null
    const raw = (data as { legs?: unknown } | null)?.legs
    if (!Array.isArray(raw) || raw.length !== coordinates.length - 1) return null
    const legs = raw.map((leg) => toLeg(leg as RawLeg))
    return legs.every((leg) => leg !== null) ? (legs as GoogleLeg[]) : null
  } catch {
    return null
  }
}

/**
 * Driving seconds between every pair of points from Google Compute Route Matrix. `null` when
 * Google is not configured, fails, or the matrix is incomplete, so callers can fall back.
 */
export async function googleDurationMatrix(
  coordinates: Array<[longitude: number, latitude: number]>,
): Promise<Array<Array<number | null>> | null> {
  try {
    const { data, error } = await requireSupabase().functions.invoke('route-times', {
      body: { mode: 'matrix', points: coordinates.map(([lng, lat]) => ({ lat, lng })) },
    })
    if (error) return null
    const matrix = (data as { matrix?: unknown } | null)?.matrix
    return Array.isArray(matrix) &&
      matrix.length === coordinates.length &&
      matrix.every(
        (row) =>
          Array.isArray(row) &&
          row.length === coordinates.length &&
          row.every(
            (value) => value === null || (typeof value === 'number' && Number.isFinite(value)),
          ),
      )
      ? (matrix as Array<Array<number | null>>)
      : null
  } catch {
    return null
  }
}
