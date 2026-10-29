import type { DailyRoute, DailyRouteStop, Letter } from '@/shared/types'

export const DRIVER_SHEET_HEADER = [
  'LOCALIDAD',
  'RECOGIDA/ENTREGA',
  'NOMBRE',
  'BOX',
  'RAZA',
  'TELÉFONO',
  'HORA',
  'ESTADO',
]

/** One row per service in stop order; the physical van box is written for the driver. */
export function driverSheetRows(
  route: DailyRoute,
  stops: DailyRouteStop[],
  letters: Letter[],
  arrival: (stop: DailyRouteStop) => string,
) {
  return stops.flatMap((stop) =>
    route.actions
      .filter((action) =>
        action.stopId ? action.stopId === stop.id : action.stop === stop.locality,
      )
      .map((action) => {
        // The label is "breed · species", or just the species when there is no breed,
        // so it only counts as a breed when it has both parts.
        const labelParts = action.animalLabel?.split(' · ') ?? []
        const breed =
          letters
            .find((letter) => letter.id === action.letterId)
            ?.animals.find((animal) => animal.id === action.animalId)?.breed ||
          (labelParts.length > 1 ? labelParts[0] : '')
        return [
          stop.locality.toUpperCase(),
          action.type === 'recogida' ? 'Recogida' : 'Entrega',
          action.customer,
          action.box ?? '',
          breed,
          action.phone,
          arrival(stop),
          '',
        ]
      }),
  )
}
