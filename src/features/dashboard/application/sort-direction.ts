import type { SortDirection } from './paginated-lists'

export function toggleSortDirection(direction: SortDirection): SortDirection {
  return direction === 'desc' ? 'asc' : 'desc'
}
