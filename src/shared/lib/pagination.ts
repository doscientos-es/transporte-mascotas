export type PaginationWindow<Item> = {
  items: Item[]
  page: number
  pageCount: number
  firstRecord: number
  lastRecord: number
}

export function paginate<Item>(
  source: readonly Item[],
  requestedPage: number,
  pageSize: number,
): PaginationWindow<Item> {
  const safePageSize = Math.max(1, Math.floor(pageSize))
  const pageCount = Math.max(1, Math.ceil(source.length / safePageSize))
  const page = Math.min(Math.max(1, Math.floor(requestedPage)), pageCount)
  const firstRecord = source.length === 0 ? 0 : (page - 1) * safePageSize + 1
  const lastRecord = Math.min(page * safePageSize, source.length)

  return {
    items: source.slice((page - 1) * safePageSize, page * safePageSize),
    page,
    pageCount,
    firstRecord,
    lastRecord,
  }
}
