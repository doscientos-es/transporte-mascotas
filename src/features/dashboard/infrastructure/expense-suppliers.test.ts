import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/shared/infrastructure/supabase', () => ({ requireSupabase: () => ({ rpc, from }) }))

import { loadExpenseSupplierPage, searchExpenseSuppliers } from './expense-suppliers'

describe('expense supplier lookup', () => {
  beforeEach(() => vi.resetAllMocks())

  it('loads saved fiscal details using a trimmed search', async () => {
    const supplier = { id: '1', name: 'Proveedor', nif: 'B123', address: 'Calle Mayor' }
    rpc.mockResolvedValue({ data: [supplier], error: null })
    expect(await searchExpenseSuppliers('  Proveedor  ')).toEqual([supplier])
    expect(rpc).toHaveBeenCalledWith('search_expense_suppliers', { p_query: 'Proveedor' })
  })

  it('propagates lookup errors so the form can offer manual entry', async () => {
    const error = new Error('Unavailable')
    rpc.mockResolvedValue({ data: null, error })
    await expect(searchExpenseSuppliers('Proveedor')).rejects.toBe(error)
  })
})

describe('expense supplier directory', () => {
  beforeEach(() => vi.resetAllMocks())

  function setup(response: { data: unknown; count: number | null; error: Error | null }) {
    const request = Object.assign(Promise.resolve(response), {
      select: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
      ilike: vi.fn(),
    })
    request.select.mockReturnValue(request)
    request.order.mockReturnValue(request)
    request.range.mockReturnValue(request)
    request.ilike.mockReturnValue(request)
    from.mockReturnValue(request)
    return request
  }

  it('loads a stable, paginated supplier directory filtered by literal name', async () => {
    const supplier = { id: '1', name: 'Proveedor', nif: 'B123', address: 'Calle Mayor' }
    const request = setup({ data: [supplier], count: 25, error: null })
    expect(await loadExpenseSupplierPage(2, '  Proveedor_100%  ')).toEqual({
      items: [supplier],
      total: 25,
    })
    expect(from).toHaveBeenCalledWith('expense_suppliers')
    expect(request.select).toHaveBeenCalledWith('id,name,nif,address', { count: 'exact' })
    expect(request.order.mock.calls).toEqual([['name'], ['id']])
    expect(request.range).toHaveBeenCalledWith(12, 23)
    expect(request.ilike).toHaveBeenCalledWith('name', '%Proveedor\\_100\\%%')
  })

  it('loads all suppliers without a search and propagates errors', async () => {
    const error = new Error('Unavailable')
    const request = setup({ data: null, count: null, error })
    await expect(loadExpenseSupplierPage(1, '')).rejects.toBe(error)
    expect(request.range).toHaveBeenCalledWith(0, 11)
    expect(request.ilike).not.toHaveBeenCalled()
  })
})
