import { describe, expect, it } from 'vitest'

import type { Expense } from '../infrastructure/finance'
import {
  expenseCategoryLabel,
  expenseCategoryValue,
  expensesByCategory,
  expensesToCsv,
} from './finance-summary'

const customExpense: Expense = {
  id: 'expense-1',
  expenseDate: '2026-10-16',
  vendor: 'Proveedor',
  vendorNif: '',
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

  it('normalizes suggested labels while preserving custom text', () => {
    expect(expenseCategoryValue('  Combustible  ')).toBe('combustible')
    expect(expenseCategoryValue('Mantenimiento de jaulas')).toBe('Mantenimiento de jaulas')
  })
})
