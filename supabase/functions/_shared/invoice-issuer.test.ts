import { afterEach, describe, expect, it, vi } from 'vitest'

import { invoiceIssuerSnapshot, requireInvoiceIssuerSnapshot } from './invoice-issuer.ts'

afterEach(() => vi.unstubAllGlobals())

describe('invoice issuer', () => {
  it('uses the commercial name even when a legacy issuer name is configured', () => {
    const values: Record<string, string> = {
      INVOICE_ISSUER_NAME: 'Previous issuer',
      INVOICE_ISSUER_TAX_ID: 'TEST',
      INVOICE_ISSUER_ADDRESS: 'Test address',
    }
    vi.stubGlobal('Deno', { env: { get: (key: string) => values[key] } })

    expect(requireInvoiceIssuerSnapshot()).toEqual({
      name: 'Kache Envíos',
      taxId: 'TEST',
      address: 'Test address',
    })
  })

  it('does not require the legacy issuer name', () => {
    const values: Record<string, string> = {
      INVOICE_ISSUER_TAX_ID: 'TEST',
      INVOICE_ISSUER_ADDRESS: 'Test address',
    }
    vi.stubGlobal('Deno', { env: { get: (key: string) => values[key] } })

    expect(requireInvoiceIssuerSnapshot().name).toBe('Kache Envíos')
  })

  it.each(['INVOICE_ISSUER_TAX_ID', 'INVOICE_ISSUER_ADDRESS'])('rejects missing %s', (missing) => {
    vi.stubGlobal('Deno', { env: { get: (key: string) => (key === missing ? '' : 'value') } })

    expect(invoiceIssuerSnapshot()).toBeNull()
    expect(requireInvoiceIssuerSnapshot).toThrow('Faltan los datos fiscales del emisor.')
  })
})
