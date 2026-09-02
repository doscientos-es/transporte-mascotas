import { describe, expect, it, vi } from 'vitest'

import type { DailyRouteStop } from '@/shared/types'

const { updates } = vi.hoisted(() => ({ updates: [] as Record<string, unknown>[] }))

vi.mock('@/shared/infrastructure/supabase', () => ({
  requireSupabase: () => ({
    from: () => ({
      update: (values: Record<string, unknown>) => {
        updates.push(values)
        const query = Promise.resolve({ error: null }) as Promise<{ error: null }> & {
          eq: () => typeof query
          select: () => Promise<{ data: { id: string }[]; error: null }>
        }
        query.eq = () => query
        query.select = () => Promise.resolve({ data: [{ id: 'stop' }], error: null })
        return query
      },
    }),
  }),
}))

import { updateDailyRouteStops } from './routes'

const stop = (id: string): DailyRouteStop => ({
  id,
  locality: id,
  place: '',
  mapUrl: '',
  minutes: 0,
  kind: 'parada',
  dwellMinutes: 15,
})

describe('updateDailyRouteStops', () => {
  it('temporarily renumbers stops before assigning their reordered sequences', async () => {
    updates.length = 0

    await updateDailyRouteStops('route-1', [stop('second'), stop('first')])

    expect(updates.map(({ sequence }) => sequence)).toEqual([100000, 100001, 1, 2])
  })
})
