import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    requireSupabase: vi.fn(),
    rpc: vi.fn(),
  },
}))

vi.mock('@/shared/infrastructure/supabase', () => ({
  requireSupabase: mocks.requireSupabase,
  supabase: null,
}))

describe('removePendingPaymentRequest', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    mocks.requireSupabase.mockReturnValue({ rpc: mocks.rpc })
  })

  it('delegates cancellation and its payment guards to the protected database function', async () => {
    const { removePendingPaymentRequest } = await import('./clients')

    await removePendingPaymentRequest('draft-1')

    expect(mocks.rpc).toHaveBeenCalledWith('cancel_invoice_payment_request', {
      p_invoice_id: 'draft-1',
    })
  })

  it('surfaces database guard errors without pretending the request was removed', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error('No se puede quitar una solicitud con un cobro iniciado o confirmado.'),
    })
    const { removePendingPaymentRequest } = await import('./clients')

    await expect(removePendingPaymentRequest('draft-1')).rejects.toThrow(
      'No se puede quitar una solicitud con un cobro iniciado o confirmado.',
    )
  })
})

describe('invoice history', () => {
  it('maps internal cancellation metadata returned by the paginated list', async () => {
    mocks.requireSupabase.mockReturnValue({ rpc: mocks.rpc })
    mocks.rpc.mockResolvedValue({
      error: null,
      data: {
        total: 1,
        items: [
          {
            id: 'draft',
            letter_id: null,
            client_id: 'client',
            payer: 'manual',
            concept: 'Extra',
            total_amount: '121',
            status: 'emitida',
            created_at: '2026-11-10',
            client_name: 'Test',
            issued_invoice_id: 'issued',
            issued_number: 'F-1',
            issued_at: '2026-11-10',
            fiscal_snapshot: {},
            cancelled_at: '2026-11-18',
            cancellation_reason: 'Duplicada',
          },
        ],
      },
    })
    const { loadInvoicePage } = await import('./clients')
    const page = await loadInvoicePage({ query: '', sort: 'date', direction: 'desc', page: 1 })
    expect(page.items[0]).toMatchObject({
      cancelledAt: '2026-11-18',
      cancellationReason: 'Duplicada',
    })
  })
})
