import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
}))

vi.mock('@/shared/infrastructure/supabase', () => ({ requireSupabase: () => db }))

import { loadExpenses, saveExpense, type ExpenseInput } from './finance'

const input: ExpenseInput = {
  expenseDate: '2026-11-10',
  vendor: 'Proveedor',
  vendorNif: 'B123',
  vendorAddress: '  Calle Mayor 1, Madrid  ',
  invoiceReference: 'F-1',
  concept: 'Servicio',
  category: 'otros',
  netAmount: 100,
  vatRate: 21,
  notes: '',
}

const row = {
  id: 'expense-1',
  expense_date: input.expenseDate,
  vendor: input.vendor,
  vendor_nif: input.vendorNif,
  vendor_address: 'Calle Mayor 1, Madrid',
  invoice_reference: input.invoiceReference,
  concept: input.concept,
  category: input.category,
  net_amount: 100,
  vat_rate: 21,
  vat_amount: 21,
  total_amount: 121,
  notes: '',
  document_path: null,
  document_name: null,
}

describe('expense vendor fiscal address', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.from.mockReturnValue(db)
    db.select.mockReturnValue(db)
    db.insert.mockReturnValue(db)
    db.update.mockReturnValue(db)
    db.eq.mockReturnValue(db)
  })

  it('loads the saved fiscal address', async () => {
    db.order.mockReturnValueOnce(db).mockResolvedValueOnce({ data: [row], error: null })
    const expenses = await loadExpenses('', '')
    expect(db.select).toHaveBeenCalledWith(expect.stringContaining('vendor_address'))
    expect(expenses[0]?.vendorAddress).toBe('Calle Mayor 1, Madrid')
  })

  it('saves the address when creating an expense', async () => {
    db.single.mockResolvedValue({ data: row, error: null })
    const expense = await saveExpense(input, { userId: 'admin' })
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({ vendor_address: 'Calle Mayor 1, Madrid', created_by: 'admin' }),
    )
    expect(expense.vendorAddress).toBe('Calle Mayor 1, Madrid')
  })

  it('allows an existing address to be cleared when editing', async () => {
    db.single
      .mockResolvedValueOnce({ data: { document_path: null }, error: null })
      .mockResolvedValueOnce({ data: { ...row, vendor_address: '' }, error: null })
    const expense = await saveExpense({ ...input, vendorAddress: '  ' }, { id: row.id })
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ vendor_address: '' }))
    expect(expense.vendorAddress).toBe('')
  })
})
