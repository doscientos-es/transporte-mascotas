import type { DailyRouteStop } from '@/shared/types'

function normalizedLocality(value: string) {
  return value.trim().toLocaleLowerCase()
}

/** Finds the first origin → destination segment that follows the route's itinerary. */
export function findForwardRouteSegment(
  stops: DailyRouteStop[],
  origin: string,
  destination: string,
  originStopId?: string,
  destinationStopId?: string,
) {
  if (originStopId || destinationStopId) {
    if (!originStopId || !destinationStopId) return null
    const originIndex = stops.findIndex((stop) => stop.id === originStopId)
    const destinationIndex = stops.findIndex((stop) => stop.id === destinationStopId)
    const originStop = stops[originIndex]
    const destinationStop = stops[destinationIndex]
    if (
      originIndex < 0 ||
      destinationIndex <= originIndex ||
      !originStop ||
      !destinationStop ||
      normalizedLocality(originStop.locality) !== normalizedLocality(origin) ||
      normalizedLocality(destinationStop.locality) !== normalizedLocality(destination)
    ) {
      return null
    }
    return { originStop, destinationStop }
  }

  const normalizedOrigin = normalizedLocality(origin)
  const normalizedDestination = normalizedLocality(destination)
  if (!normalizedOrigin || !normalizedDestination) return null

  for (const [originIndex, originStop] of stops.entries()) {
    if (normalizedLocality(originStop.locality) !== normalizedOrigin) continue
    const destinationStop = stops
      .slice(originIndex + 1)
      .find((stop) => normalizedLocality(stop.locality) === normalizedDestination)
    if (destinationStop) return { originStop, destinationStop }
  }

  return null
}
