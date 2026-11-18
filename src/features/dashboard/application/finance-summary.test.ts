import { describe, expect, it } from 'vitest'

import type { Expense, FinanceIncome } from '../infrastructure/finance'
import {
  expenseCategoryLabel,
  expenseCategoryValue,
  expensesByCategory,
  expensesToCsv,
  filterFinanceExpenses,
  incomeToCsv,
  monthlyBreakdown,
  movementsToCsv,
  summarizeFinance,
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
  lines: [{ description: '', netAmount: 50, vatRate: 21 }],
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

  it('exports every distinct VAT rate instead of a misleading single rate', () => {
    const expense = {
      ...customExpense,
      lines: [
        { description: '', netAmount: 50, vatRate: 21 },
        { description: '', netAmount: 20, vatRate: 10 },
        { description: '', netAmount: 10, vatRate: 21 },
      ],
    }
    expect(expensesToCsv([expense])).toContain('"21 / 10"')
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

describe('internally cancelled income', () => {
  const invoice: FinanceIncome = {
    issuedInvoiceId: 'issued-1',
    invoiceDraftId: 'draft-1',
    issuedOn: '2026-11-10',
    invoiceNumber: 'F-1',
    clientName: 'Cliente',
    clientNif: 'TEST',
    concept: 'Servicio',
    netAmount: 100,
    vatAmount: 21,
    totalAmount: 121,
  }
  const cancelled = {
    ...invoice,
    issuedInvoiceId: 'issued-2',
    invoiceNumber: 'F-2',
    cancelledAt: '2026-11-18T12:00:00Z',
  }

  it('excludes cancelled income from profit but retains the original VAT', () => {
    expect(summarizeFinance([invoice, cancelled], [])).toMatchObject({
      incomeNet: 100,
      incomeTotal: 121,
      incomeVat: 42,
      vatBalance: 42,
      profit: 100,
    })
    expect(monthlyBreakdown([invoice, cancelled], [])).toEqual([
      { month: '2026-11', incomeNet: 100, expenseNet: 0, profit: 100 },
    ])
  })

  it('marks the retained invoice in the fiscal export and excludes it from operational movements', () => {
    expect(incomeToCsv([cancelled])).toContain('"Anulada internamente"')
    expect(incomeToCsv([cancelled])).toContain('"21.00"')
    expect(movementsToCsv([invoice, cancelled], [])).toContain('"F-1"')
    expect(movementsToCsv([invoice, cancelled], [])).not.toContain('"F-2"')
  })
})
