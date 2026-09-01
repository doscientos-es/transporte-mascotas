import { describe, expect, it } from 'vitest'

import {
  CLIENT_LIST_PAGE_SIZE,
  INVOICE_LIST_PAGE_SIZE,
  clientSortOptions,
  invoiceSortOptions,
} from './paginated-lists'

describe('paginated dashboard lists', () => {
  it('keeps interactive pages small and exposes only supported sort fields', () => {
    expect(CLIENT_LIST_PAGE_SIZE).toBe(12)
    expect(INVOICE_LIST_PAGE_SIZE).toBe(12)
    expect(clientSortOptions).toEqual(['name', 'city', 'created_at'])
    expect(invoiceSortOptions).toEqual(['date', 'total', 'client', 'status'])
  })
})