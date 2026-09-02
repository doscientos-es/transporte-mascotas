import { DEFAULT_STOP_DWELL_MINUTES } from '@/shared/constants/route-defaults'
import type { DailyRouteStop, RouteDirection, RouteTemplate } from '@/shared/types'

/** Copies only the selected template stops in the direction of the daily route. */
export function dailyRouteStopsForTemplate(
  template: RouteTemplate,
  direction: RouteDirection = 'normal',
  selectedStopIds = template.stops.map((stop) => stop.id),
): DailyRouteStop[] {
  const selectedStops = new Set(selectedStopIds)
  const stops = template.stops
    .filter((stop) => selectedStops.has(stop.id))
    .map((stop) => ({ ...stop, kind: 'parada' as const, dwellMinutes: DEFAULT_STOP_DWELL_MINUTES }))

  return direction === 'inversa' ? stops.toReversed() : stops
}
