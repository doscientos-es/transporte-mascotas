/** Stops where a letter may start: every route stop except the last one. */
export function letterOriginOptions(stops: string[]) {
  return stops.slice(0, -1)
}

/** Stops after the selected origin, in route order. */
export function letterDestinationOptions(stops: string[], origin: string) {
  const originIndex = stops.indexOf(origin)
  return originIndex < 0 ? [] : stops.slice(originIndex + 1)
}
