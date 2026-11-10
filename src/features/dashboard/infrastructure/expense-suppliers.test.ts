import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/shared/infrastructure/supabase', () => ({ requireSupabase: () => ({ rpc }) }))

import { searchExpenseSuppliers } from './expense-suppliers'

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