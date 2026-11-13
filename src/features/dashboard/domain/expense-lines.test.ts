import { describe, expect, it } from 'vitest'

import { expenseLineTotals, parseExpenseLines, type ExpenseLineDraft } from './expense-lines'

const draft = (id: number, netAmount: string, vatRate: string): ExpenseLineDraft => ({
  id,
  netAmount,
  vatRate,
  description: ' Servicio ',
})

describe('expense lines', () => {
  it('parses separate bases and rates and rounds tax per line', () => {
    const lines = parseExpenseLines([
      draft(1, '100,00', '21'),
      draft(2, '50', '10'),
      draft(3, '0,05', '10'),
    ])
    expect(lines[0]).toEqual({ description: 'Servicio', netAmount: 100, vatRate: 21 })
    expect(expenseLineTotals(lines)).toEqual({
      netAmount: 150.05,
      vatAmount: 26.01,
      totalAmount: 176.06,
    })
  })

  it.each([
    ['', '21'],
    ['-1', '21'],
    ['1.001', '21'],
    ['1', ''],
    ['1', '101'],
    ['1', '1.001'],
  ])('rejects invalid base %s or VAT %s', (net, rate) => {
    expect(() => parseExpenseLines([draft(1, net, rate)])).toThrow()
  })

  it('requires at least one line and a total within the database limit', () => {
    expect(() => parseExpenseLines([])).toThrow()
    expect(() => parseExpenseLines([draft(1, '9999999999.99', '21')])).toThrow()
  })
})
