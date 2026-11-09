import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    requireSupabase: vi.fn(),
    from: vi.fn(),
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
  },
}))

vi.mock('@/shared/infrastructure/supabase', () => ({ requireSupabase: mocks.requireSupabase }))

import { loadTransportRequests } from './transport-requests'

describe('loadTransportRequests filters', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    const query = Object.assign(Promise.resolve({ data: [], error: null }), {
      select: mocks.select,
      order: mocks.order,
      eq: mocks.eq,
      in: mocks.in,
    })
    for (const method of [mocks.select, mocks.order, mocks.eq, mocks.in]) {
      method.mockReturnValue(query)
    }
    mocks.from.mockReturnValue(query)
    mocks.requireSupabase.mockReturnValue({ from: mocks.from })
  })

  it('applies requester and status filters in the same database query', async () => {
    await loadTransportRequests({ requesterId: 'client-1', statuses: ['pago_pendiente'] })

    expect(mocks.eq).toHaveBeenCalledWith('requester_id', 'client-1')
    expect(mocks.in).toHaveBeenCalledWith('status', ['pago_pendiente'])
  })

  it('does not add a status filter when none is requested', async () => {
    await loadTransportRequests({ requesterId: 'client-1' })

    expect(mocks.eq).toHaveBeenCalledWith('requester_id', 'client-1')
    expect(mocks.in).not.toHaveBeenCalled()
  })
})
