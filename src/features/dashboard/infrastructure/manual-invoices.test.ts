import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClientInvoice, IssuedInvoice, ManualInvoiceInput } from '@/shared/types'

const { invoke, rpc } = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn() }))
vi.mock('@/shared/infrastructure/supabase', () => ({
  supabase: null,
  requireSupabase: () => ({ functions: { invoke }, rpc }),
}))

import { canCancelManualInvoice } from '../application/manual-invoices'
import { loadInvoicePage } from './clients'
import { cancelManualInvoice, createPaidManualInvoice } from './manual-invoices'

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
  it('loads an issued free invoice without fabricating a carriage-letter reference', async () => {
    rpc.mockResolvedValue({
      data: {
        total: 1,
        items: [
          {
            id: input.id,
            letter_id: null,
            client_id: 'client',
            payer: 'manual',
            concept: 'Extra',
            total_amount: '121.00',
            status: 'emitida',
            created_at: '2026-01-10',
            client_name: 'Test',
            issued_invoice_id: 'issued',
            issued_number: 'F-2026-000001',
            issued_at: '2026-01-10',
            fiscal_snapshot: { concept: 'Extra', operation_date: input.operationDate },
          },
        ],
      },
      error: null,
    })
    const result = await loadInvoicePage({
      query: '',
      status: 'emitida',
      sort: 'date',
      direction: 'desc',
      page: 1,
    })
    expect(result).toMatchObject({
      total: 1,
      items: [
        {
          id: input.id,
          letterId: null,
          total: 121,
          issuedInvoice: {
            number: 'F-2026-000001',
            fiscalSnapshot: { concept: 'Extra', operation_date: input.operationDate },
          },
        },
      ],
    })
  })

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

const issuedInvoice: IssuedInvoice = {
  id: 'issued-1',
  invoiceDraftId: 'draft-1',
  number: 'F-1',
  issuedAt: '2026-11-10',
  fiscalSnapshot: { total_amount: 121 },
}

const invoice: ClientInvoice = {
  id: 'draft-1',
  letterId: null,
  clientId: 'client-1',
  payer: 'manual',
  concept: 'Servicio',
  total: 121,
  status: 'emitida',
  createdAt: '2026-11-10',
  clientName: 'Cliente',
  issuedInvoice,
}

describe('internal manual invoice cancellation', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it('only offers cancellation for an active, independently issued manual invoice', () => {
    expect(canCancelManualInvoice(invoice)).toBe(true)
    expect(canCancelManualInvoice({ ...invoice, letterId: 'letter-1' })).toBe(false)
    expect(canCancelManualInvoice({ ...invoice, cancelledAt: '2026-11-18' })).toBe(false)
    expect(canCancelManualInvoice({ ...invoice, issuedInvoice: undefined })).toBe(false)
  })

  it('sends the invoice snapshot and trimmed reason and propagates errors', async () => {
    rpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('Factura modificada') })
    await cancelManualInvoice(issuedInvoice, '  Duplicada  ')
    expect(rpc).toHaveBeenCalledWith('cancel_manual_invoice', {
      p_invoice_id: invoice.id,
      p_expected_snapshot: issuedInvoice.fiscalSnapshot,
      p_reason: 'Duplicada',
    })
    await expect(cancelManualInvoice(issuedInvoice, 'Duplicada')).rejects.toThrow(
      'Factura modificada',
    )
  })
})
