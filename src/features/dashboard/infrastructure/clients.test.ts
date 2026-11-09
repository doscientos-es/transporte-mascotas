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
