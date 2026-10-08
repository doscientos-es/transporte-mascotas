type RouteStopOption = { id: string; locality: string; label: string }
type RouteStop = Pick<RouteStopOption, 'id' | 'locality'>

function labelledStops(stops: RouteStop[]): RouteStopOption[] {
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

/** Pickup choices include every stop except the last, retaining repeated localities. */
export function pickupOptions(stops: RouteStop[]) {
  return labelledStops(stops).slice(0, -1)
}

/** Delivery choices include every stop after the selected pickup stop. */
export function deliveryOptions(stops: RouteStop[], originStopId: string) {
  const pickupIndex = stops.findIndex((stop) => stop.id === originStopId)
  if (!originStopId || pickupIndex < 0) return []
  return labelledStops(stops).slice(pickupIndex + 1)
}

type RouteSelection = {
  dailyRouteId: string
  origin: string
  destination: string
  originStopId?: string
  destinationStopId?: string
  desiredDate: string
}

/** Returns a user-facing error, or '' when the chosen route, pickup and delivery are valid. */
export function routeSelectionError(
  routes: {
    id: string
    serviceDate: string
    localities: string[]
    stops?: RouteStop[]
  }[],
  selection: RouteSelection,
) {
  const { dailyRouteId, origin, destination, originStopId, destinationStopId, desiredDate } =
    selection
  if (!dailyRouteId || !origin || !destination || !desiredDate)
    return 'Selecciona una ruta, una recogida y una entrega para continuar.'
  const route = routes.find((item) => item.id === dailyRouteId)
  if (!route || route.serviceDate !== desiredDate)
    return 'La ruta seleccionada ya no está disponible. Elige otra ruta.'
  const stops =
    route.stops ?? route.localities.map((locality, index) => ({ id: String(index), locality }))
  if (originStopId || destinationStopId) {
    const pickupIndex = stops.findIndex((stop) => stop.id === originStopId)
    const deliveryIndex = stops.findIndex((stop) => stop.id === destinationStopId)
    if (
      pickupIndex < 0 ||
      pickupIndex === stops.length - 1 ||
      deliveryIndex <= pickupIndex ||
      stops[pickupIndex]?.locality !== origin ||
      stops[deliveryIndex]?.locality !== destination
    ) {
      return 'Elige una entrega posterior a la recogida dentro de la ruta.'
    }
  } else {
    const normalizedOrigin = origin.trim().toLocaleLowerCase()
    const normalizedDestination = destination.trim().toLocaleLowerCase()
    const validSegment = stops.slice(0, -1).some(
      (stop, pickupIndex) =>
        stop.locality.trim().toLocaleLowerCase() === normalizedOrigin &&
        stops
          .slice(pickupIndex + 1)
          .some(
            (nextStop) => nextStop.locality.trim().toLocaleLowerCase() === normalizedDestination,
          ),
    )
    if (!validSegment) return 'Elige una entrega posterior a la recogida dentro de la ruta.'
  }
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
