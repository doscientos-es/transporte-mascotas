import { describe, expect, it } from 'vitest'

import type { Expense } from '../infrastructure/finance'
import {
  expenseCategoryLabel,
  expenseCategoryValue,
  expensesByCategory,
  expensesToCsv,
  filterFinanceExpenses,
} from './finance-summary'

const customExpense: Expense = {
  id: 'expense-1',
  expenseDate: '2026-10-16',
  vendor: 'Proveedor',
  vendorNif: '',
  vendorAddress: 'Calle Mayor 1, Madrid',
  invoiceReference: '',
  concept: 'Mantenimiento',
  category: 'Mantenimiento de jaulas',
  netAmount: 50,
  vatRate: 21,
  vatAmount: 10.5,
  totalAmount: 60.5,
  notes: '',
  documentPath: null,
  documentName: null,
}

describe('custom expense categories', () => {
  it('keeps custom category names in summaries and CSV exports', () => {
    expect(expenseCategoryLabel(customExpense.category)).toBe('Mantenimiento de jaulas')
    expect(expensesByCategory([customExpense])[0]?.category).toBe('Mantenimiento de jaulas')
    expect(expensesToCsv([customExpense])).toContain('"Mantenimiento de jaulas"')
  })

  it('includes the vendor fiscal address in the expense export', () => {
    const exported = expensesToCsv([customExpense])
    expect(exported).toContain('"Dirección fiscal del proveedor"')
    expect(exported).toContain('"Calle Mayor 1, Madrid"')
  })

  it('normalizes suggested labels while preserving custom text', () => {
    expect(expenseCategoryValue('  Combustible  ')).toBe('combustible')
    expect(expenseCategoryValue('Mantenimiento de jaulas')).toBe('Mantenimiento de jaulas')
  })
})

describe('filterFinanceExpenses', () => {
  it('searches expense details and combines the query with the category filter', () => {
    const expenseWithReference = { ...customExpense, invoiceReference: 'MNT-2026-014' }

    expect(filterFinanceExpenses([customExpense], '  mantenimiento ', '')).toEqual([customExpense])
    expect(filterFinanceExpenses([customExpense], 'proveedor', customExpense.category)).toEqual([
      customExpense,
    ])
    expect(filterFinanceExpenses([expenseWithReference], 'mnt-2026-014', '')).toEqual([
      expenseWithReference,
    ])
    expect(filterFinanceExpenses([customExpense], 'proveedor', 'combustible')).toEqual([])
  })
})
