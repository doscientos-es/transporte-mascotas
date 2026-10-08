type RouteStop = { id: string; locality: string }
export type LetterRouteStopOption = RouteStop & { label: string }

export function labelledRouteStops(stops: RouteStop[]): LetterRouteStopOption[] {
  const counts = new Map<string, number>()
  for (const stop of stops) {
    const key = stop.locality.trim().toLocaleLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return stops.map((stop, index) => ({
    ...stop,
    label:
      (counts.get(stop.locality.trim().toLocaleLowerCase()) ?? 0) > 1
        ? `${stop.locality} · parada ${index + 1}`
        : stop.locality,
  }))
}

/** Stops where a letter may start: every route stop except the last one. */
export function letterOriginOptions(stops: RouteStop[]) {
  return labelledRouteStops(stops).slice(0, -1)
}

/** Stops after the selected origin stop, in route order. */
export function letterDestinationOptions(stops: RouteStop[], originStopId: string) {
  const originIndex = stops.findIndex((stop) => stop.id === originStopId)
  return originIndex < 0 ? [] : labelledRouteStops(stops).slice(originIndex + 1)
}
