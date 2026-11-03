import { describe, expect, it } from 'vitest'

import type { ManualInvoiceInput } from '@/shared/types'

import { invoiceAmounts, validateManualInvoice } from './invoice-values'

const input: ManualInvoiceInput = {
  id: '11111111-1111-4111-8111-111111111111',
  client: {
    fullName: ' Cliente de prueba ',
    nif: ' TEST ',
    address: ' Calle de prueba ',
    postalCode: '08001',
    city: 'Barcelona',
    email: '',
    phone: '',
  },
  concept: ' Cuidado adicional ',
  operationDate: '2026-01-10',
  total: 121,
  paymentMethod: 'Transferencia',
}

describe('manual invoice values', () => {
  it('normalizes a free invoice without a carriage letter', () => {
    expect(validateManualInvoice(input)).toMatchObject({
      id: input.id,
      concept: 'Cuidado adicional',
      client: { fullName: 'Cliente de prueba', nif: 'TEST', address: 'Calle de prueba' },
    })
  })

  it.each([0.01, 0.02, 10, 30, 99.99, 121, 999999.99])(
    'keeps base plus VAT equal to total for %s',
    (total) => {
      const amounts = invoiceAmounts(total)
      expect(Math.round((amounts.netAmount + amounts.vatAmount) * 100)).toBe(
        Math.round(total * 100),
      )
      expect(amounts.totalAmount).toBe(total)
      if (total === 121)
        expect(amounts).toEqual({ netAmount: 100, vatAmount: 21, totalAmount: 121 })
    },
  )

  it.each([0, -1, NaN, Infinity, 1.001, 1000000])('rejects an invalid total: %s', (total) => {
    expect(() => validateManualInvoice({ ...input, total })).toThrow('El total')
  })

  it.each(['fullName', 'nif', 'address', 'postalCode', 'city'] as const)(
    'requires fiscal field %s',
    (field) => {
      expect(() =>
        validateManualInvoice({ ...input, client: { ...input.client, [field]: ' ' } }),
      ).toThrow('datos fiscales')
    },
  )

  it.each(['', '2026-02-30', 'not-a-date', '2099-01-01'])(
    'rejects invalid or future operation date %s',
    (operationDate) => {
      expect(() => validateManualInvoice({ ...input, operationDate })).toThrow('fecha de operación')
    },
  )

  it.each([' ', 'a'.repeat(501)])('rejects an empty or oversized concept', (concept) => {
    expect(() => validateManualInvoice({ ...input, concept })).toThrow('concepto')
  })
})
