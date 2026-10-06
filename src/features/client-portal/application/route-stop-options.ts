/** Localities a client can be picked up at: every stop except the last, without repeats. */
export function pickupOptions(localities: string[]) {
  return [...new Set(localities.slice(0, -1))]
}

/**
 * Localities a client can be delivered to: those after the first occurrence of the pickup,
 * without repeats and never the pickup itself (a route may come back to the same town).
 */
export function deliveryOptions(localities: string[], origin: string) {
  const pickupIndex = localities.indexOf(origin)
  if (!origin || pickupIndex < 0) return []
  return [...new Set(localities.slice(pickupIndex + 1))].filter((locality) => locality !== origin)
}

type RouteSelection = {
  dailyRouteId: string
  origin: string
  destination: string
  desiredDate: string
}

/** Returns a user-facing error, or '' when the chosen route, pickup and delivery are valid. */
export function routeSelectionError(
  routes: { id: string; serviceDate: string; localities: string[] }[],
  selection: RouteSelection,
) {
  const { dailyRouteId, origin, destination, desiredDate } = selection
  if (!dailyRouteId || !origin || !destination || !desiredDate)
    return 'Selecciona una ruta, una recogida y una entrega para continuar.'
  const route = routes.find((item) => item.id === dailyRouteId)
  if (!route || route.serviceDate !== desiredDate)
    return 'La ruta seleccionada ya no está disponible. Elige otra ruta.'
  if (
    !pickupOptions(route.localities).includes(origin) ||
    !deliveryOptions(route.localities, origin).includes(destination)
  )
    return 'Elige una entrega posterior a la recogida dentro de la ruta.'
  return ''
}

type PartyCities = { senderCity: string; recipientCity: string }

/**
 * Suggests the sender and recipient town from the chosen pickup and delivery. A town the client
 * typed is kept; one we suggested earlier (`previous`) is replaced when the route changes.
 */
export function suggestedPartyCities(
  current: PartyCities,
  previous: PartyCities,
  route: { origin: string; destination: string },
): PartyCities {
  const pick = (value: string, last: string, suggestion: string) =>
    !value || value === last ? suggestion : value
  return {
    senderCity: pick(current.senderCity, previous.senderCity, route.origin),
    recipientCity: pick(current.recipientCity, previous.recipientCity, route.destination),
  }
}
