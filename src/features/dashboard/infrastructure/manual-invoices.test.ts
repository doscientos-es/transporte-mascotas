import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ManualInvoiceInput } from '@/shared/types'

import { createPaidManualInvoice } from './manual-invoices'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@/shared/infrastructure/supabase', () => ({
  requireSupabase: () => ({ functions: { invoke } }),
}))
const input: ManualInvoiceInput = {
  id: '11111111-1111-4111-8111-111111111111',
  client: {
    fullName: 'Test',
    nif: 'TEST',
    address: 'Test',
    postalCode: '08001',
    city: 'Test',
    email: '',
    phone: '',
  },
  concept: 'Extra',
  operationDate: '2026-01-10',
  total: 121,
  paymentMethod: 'Bizum',
}

beforeEach(() => vi.resetAllMocks())

describe('manual invoice persistence', () => {
  it('reuses the same identity on retry and preserves a pending PDF as a successful issuance', async () => {
    invoke.mockResolvedValue({
      data: { invoiceDraftId: input.id, documentPending: true },
      error: null,
    })
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(createPaidManualInvoice(input)).resolves.toEqual({
        invoiceDraftId: input.id,
        documentPending: true,
      })
      expect(invoke).toHaveBeenLastCalledWith('create-paid-manual-invoice', { body: input })
    }
  })

  it('does not call the server when fiscal validation fails', async () => {
    await expect(
      createPaidManualInvoice({ ...input, client: { ...input.client, nif: '' } }),
    ).rejects.toThrow('NIF/CIF')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('shows a server rejection without treating it as successful', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: Response.json({ error: 'Factura rechazada' }) },
    })
    await expect(createPaidManualInvoice(input)).rejects.toThrow('Factura rechazada')
  })

  it('rejects a response without the persisted identity', async () => {
    invoke.mockResolvedValue({ data: {}, error: null })
    await expect(createPaidManualInvoice(input)).rejects.toThrow('confirmar')
  })
})
