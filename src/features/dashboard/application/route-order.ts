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

export const LETTER_ROUTE_PAST_DAYS = 5

export function madridIsoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${date.year}-${date.month}-${date.day}`
}

/** Routes offered in the letter form: newest first, hiding those that ended more than five days ago. */
export function letterRouteOptions(
  routes: DailyRoute[],
  { now = new Date(), keepRouteId }: { now?: Date; keepRouteId?: string } = {},
) {
  const cutoff = new Date(`${madridIsoDate(now)}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - LETTER_ROUTE_PAST_DAYS)
  const minimumDate = cutoff.toISOString().slice(0, 10)
  return sortRoutesByDate(
    routes.filter((route) => route.date >= minimumDate || route.id === keepRouteId),
    'desc',
  )
}
