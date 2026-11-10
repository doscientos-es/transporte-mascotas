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

import type { DailyRoute, Letter, ServiceAction } from '@/shared/types'

import { cancelCarriageLetter, loadLetters, saveManualLetter, updateLetter } from './letters'

describe('cancelCarriageLetter', () => {
  it('uses the atomic cancellation RPC and propagates database errors', async () => {
    rpc.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error('denied') })
    await cancelCarriageLetter('letter-1')
    expect(rpc).toHaveBeenCalledWith('cancel_carriage_letter', { p_letter_id: 'letter-1' })
    await expect(cancelCarriageLetter('letter-1')).rejects.toThrow('denied')
  })
})

describe('updateLetter', () => {
  const letter = {
    id: 'letter-1',
    accompanyingDocuments: ['microchip'],
    billingClient: {},
    animals: [
      {
        id: 'animal-1',
        species: 'Perro',
        breed: 'Mestizo',
        birthDate: '2020-01-01',
        size: 'mediano',
        weightKg: 12,
        lengthCm: 0,
        heightCm: 0,
        widthCm: 0,
      },
    ],
  } as unknown as Letter
  const actions = (['recogida', 'entrega'] as const).map((type, index) => ({
    id: `action-${index}`,
    letterId: letter.id,
    animalId: 'animal-1',
    type,
    stopId: `stop-${index}`,
    stop: '',
    customer: '',
    phone: '',
    status: 'pendiente' as const,
    box: 6,
  })) satisfies ServiceAction[]

  beforeEach(() => vi.resetAllMocks())

  it('sends the entire edit and assignment in one RPC, with missing measurements as null', async () => {
    rpc.mockResolvedValue({ error: null })
    await updateLetter(letter, { id: 'route-1' } as DailyRoute, actions, false, true)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith(
      'update_carriage_letter_atomically',
      expect.objectContaining({
        p_letter_id: 'letter-1',
        p_daily_route_id: 'route-1',
        p_box_number: 6,
        p_share_box: true,
        p_signature_confirmed: false,
        p_animals: [
          expect.objectContaining({
            id: 'animal-1',
            size: 'mediano',
            weight_kg: 12,
            length_cm: null,
            height_cm: null,
            width_cm: null,
          }),
        ],
        p_actions: [
          { id: 'action-0', animal_id: 'animal-1', stop_id: 'stop-0', type: 'recogida' },
          { id: 'action-1', animal_id: 'animal-1', stop_id: 'stop-1', type: 'entrega' },
        ],
      }),
    )
  })

  it('reassigns a cancelled letter using the atomic reactivation RPC and returns its status', async () => {
    rpc.mockResolvedValue({ data: 'programada', error: null })
    const result = await updateLetter(
      { ...letter, status: 'cancelada' },
      { id: 'route-1' } as DailyRoute,
      actions,
      false,
      false,
    )
    expect(result).toBe('programada')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith(
      'reassign_cancelled_carriage_letter',
      expect.objectContaining({
        p_letter_id: 'letter-1',
        p_daily_route_id: 'route-1',
        p_box_number: 6,
      }),
    )
  })

  it('propagates failures without issuing separate deletion requests', async () => {
    rpc.mockResolvedValue({ error: new Error('box ocupado') })
    await expect(
      updateLetter(letter, { id: 'route-1' } as DailyRoute, actions, false, false),
    ).rejects.toThrow('box ocupado')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('explains when the atomic edit function is missing', async () => {
    rpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'Function not found' } })
    await expect(
      updateLetter(letter, { id: 'route-1' } as DailyRoute, actions, false, false),
    ).rejects.toThrow('falta aplicar la actualización de la base de datos')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('exposes database errors returned as plain objects', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0001', message: 'No se puede editar' } })
    await expect(
      updateLetter(letter, { id: 'route-1' } as DailyRoute, actions, false, false),
    ).rejects.toThrow('No se puede editar')
    expect(rpc).toHaveBeenCalledTimes(1)
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
