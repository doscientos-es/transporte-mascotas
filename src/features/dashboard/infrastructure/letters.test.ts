import { beforeEach, describe, expect, it, vi } from 'vitest'

const { order, rpc, select } = vi.hoisted(() => ({
  order: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
}))
vi.mock('@/shared/infrastructure/supabase', () => ({
  requireSupabase: () => ({
    from: () => ({ select }),
    rpc,
  }),
}))

import type { DailyRoute, Letter } from '@/shared/types'

import { cancelCarriageLetter, loadLetters, saveManualLetter } from './letters'

describe('cancelCarriageLetter', () => {
  it('uses the atomic cancellation RPC and propagates database errors', async () => {
    rpc.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error('denied') })
    await cancelCarriageLetter('letter-1')
    expect(rpc).toHaveBeenCalledWith('cancel_carriage_letter', { p_letter_id: 'letter-1' })
    await expect(cancelCarriageLetter('letter-1')).rejects.toThrow('denied')
  })
})

describe('complimentary letters', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    select.mockReturnValue({ order })
  })

  it('maps complimentary, invoiced, and unpaid letters to the correct payment state', async () => {
    const row = {
      imported_at: '2026-01-01',
      route_templates: null,
      animals: [],
      billing_client: {},
    }
    order.mockResolvedValue({
      data: [
        { ...row, id: 'free', complimentary: true, invoice_drafts: [] },
        {
          ...row,
          id: 'paid',
          complimentary: false,
          invoice_drafts: [
            { id: 'draft-paid', status: 'emitida', issued_invoices: { id: 'issued' } },
          ],
        },
        {
          ...row,
          id: 'pending',
          complimentary: false,
          invoice_drafts: [
            { id: 'draft-pending', status: 'solicitud_pago', issued_invoices: null },
          ],
        },
        {
          ...row,
          id: 'no-issued',
          complimentary: false,
          invoice_drafts: { id: 'draft-missing', status: 'pagada', issued_invoices: [] },
        },
        {
          ...row,
          id: 'issued-array',
          complimentary: false,
          invoice_drafts: {
            id: 'draft-array',
            status: 'emitida',
            issued_invoices: [{ id: 'issued' }],
          },
        },
      ],
      error: null,
    })
    const result = await loadLetters('complimentary-test', true)
    expect(
      result.map(({ id, complimentary, paymentStatus }) => ({ id, complimentary, paymentStatus })),
    ).toEqual([
      { id: 'free', complimentary: true, paymentStatus: 'paid' },
      { id: 'paid', complimentary: false, paymentStatus: 'paid' },
      { id: 'pending', complimentary: false, paymentStatus: 'pending' },
      { id: 'no-issued', complimentary: false, paymentStatus: 'paid' },
      { id: 'issued-array', complimentary: false, paymentStatus: 'paid' },
    ])
    expect(result.map((letter) => letter.issuedInvoiceDraftId)).toEqual([
      undefined,
      'draft-paid',
      undefined,
      undefined,
      'draft-array',
    ])
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining('invoice_drafts(id,status,issued_invoices(id))'),
    )
  })

  it('sends the free flag and zero total to the same atomic creation RPC', async () => {
    rpc.mockResolvedValue({ data: 'free-id', error: null })
    const letter = {
      animals: [],
      accompanyingDocuments: [],
      billingClient: {},
    } as unknown as Letter
    await saveManualLetter(letter, { id: 'route' } as DailyRoute, [], '', true, 0, true)
    expect(rpc).toHaveBeenCalledWith(
      'create_manual_carriage_letter',
      expect.objectContaining({
        p_daily_route_id: 'route',
        p_billing_total: 0,
        p_complimentary: true,
      }),
    )
  })
})
