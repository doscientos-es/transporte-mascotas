import type { DailyRoute } from '@/shared/types'

export type RouteSortDirection = 'asc' | 'desc'

export const DEFAULT_ROUTE_SORT_DIRECTION: RouteSortDirection = 'desc'

export function sortRoutesByDate(
  routes: DailyRoute[],
  direction: RouteSortDirection = DEFAULT_ROUTE_SORT_DIRECTION,
) {
  return routes.toSorted((left, right) =>
    direction === 'asc' ? left.date.localeCompare(right.date) : right.date.localeCompare(left.date),
  )
}
