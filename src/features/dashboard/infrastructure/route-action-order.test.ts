import { beforeEach, describe, expect, it, vi } from 'vitest'

const { from, rpc, select } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), select: vi.fn() }))
vi.mock('@/shared/infrastructure/supabase', () => ({ requireSupabase: () => ({ from, rpc }) }))

import { loadDailyRoutes, updateDailyRouteStopActionOrder } from './routes'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('route stop action order persistence', () => {
  it('sends the full ordered action list to one atomic operation scoped to route and stop', async () => {
    rpc.mockResolvedValue({ error: null })
    await updateDailyRouteStopActionOrder('route-1', 'stop-2', ['delivery', 'pickup'])
    expect(rpc).toHaveBeenCalledExactlyOnceWith('reorder_daily_route_stop_actions', {
      p_daily_route_id: 'route-1',
      p_stop_id: 'stop-2',
      p_action_ids: ['delivery', 'pickup'],
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('propagates save failures so the dialog can retain the draft for retry', async () => {
    rpc.mockResolvedValue({ error: { message: 'Los servicios han cambiado' } })
    await expect(updateDailyRouteStopActionOrder('route-1', 'stop-2', ['pickup'])).rejects.toThrow(
      'Los servicios han cambiado',
    )
  })

  it('loads saved order with each stop, without depending on transporter action response order', async () => {
    const data = [
      {
        id: 'route-1',
        route_template_id: 'template',
        service_date: '2026-11-10',
        status: 'activa',
        daily_route_stops: [
          {
            id: 'stop-2',
            sequence: 1,
            locality: 'Madrid',
            meeting_point: '',
            stop_kind: 'parada',
            dwell_minutes: 15,
            action_order: ['delivery', 'pickup'],
          },
        ],
      },
    ]
    from.mockImplementation((table: string) => ({
      select: (columns: string) => {
        select(table, columns)
        return table === 'daily_routes'
          ? { order: async () => ({ data, error: null }) }
          : Promise.resolve({ data: [], error: null })
      },
    }))
    const routes = await loadDailyRoutes()
    expect(routes[0].stops?.[0].actionOrder).toEqual(['delivery', 'pickup'])
    expect(select.mock.calls.find(([table]) => table === 'daily_routes')?.[1]).toContain(
      'action_order',
    )
  })
})
