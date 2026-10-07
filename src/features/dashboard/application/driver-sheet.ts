import type { DailyRoute, DailyRouteStop, Letter } from '@/shared/types'

export const DRIVER_SHEET_HEADER = [
  'LOCALIDAD',
  'RECOGIDA/ENTREGA',
  'NOMBRE',
  'BOX',
  'TIPO MASCOTA',
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
        const breed =
          letters
            .find((letter) => letter.id === action.letterId)
            ?.animals.find((animal) => animal.id === action.animalId)?.breed ??
          action.animalLabel?.split(' · ')[0] ??
          ''
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
