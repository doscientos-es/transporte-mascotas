import { describe, expect, it, vi } from 'vitest'

import type { DailyRouteStop, RouteTemplate } from '@/shared/types'

const { updates, inserts, deletes } = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
  inserts: [] as Array<{ table: string; values: unknown }>,
  deletes: [] as Array<{ table: string; id: string }>,
}))

vi.mock('@/shared/infrastructure/supabase', () => ({
  requireSupabase: () => ({
    from: (table: string) => ({
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
      insert: (values: unknown) => {
        inserts.push({ table, values })
        return Promise.resolve({ error: null })
      },
      delete: () => ({
        eq: (_column: string, id: string) => {
          deletes.push({ table, id })
          return Promise.resolve({ error: null })
        },
      }),
    }),
  }),
}))

import { duplicateRouteTemplate, updateDailyRouteStops } from './routes'

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

describe('duplicateRouteTemplate', () => {
  it('copies the route and its stops with new ids and preserved details', async () => {
    inserts.length = 0
    const original: RouteTemplate = {
      id: 'source-template',
      name: 'Levante',
      color: '#123456',
      stops: [
        {
          id: 'source-stop',
          locality: 'Valencia',
          place: 'Estación',
          mapUrl: 'https://maps.example/valencia',
          minutes: 25,
          alias: 'Centro',
          street: 'Calle Mayor',
          streetNumber: '12',
          floor: '1º',
          postalCode: '46001',
          province: 'Valencia',
          country: 'España',
          latitude: 39.47,
          longitude: -0.37,
        },
      ],
    }

    const copy = await duplicateRouteTemplate(original, 'Levante (copia)')

    expect(copy).toMatchObject({ name: 'Levante (copia)', color: original.color })
    expect(copy.id).not.toBe(original.id)
    expect(copy.stops[0].id).not.toBe(original.stops[0].id)
    expect(copy.stops[0]).toMatchObject({ ...original.stops[0], id: copy.stops[0].id })
    expect(inserts).toEqual([
      {
        table: 'route_templates',
        values: { id: copy.id, name: copy.name, color: copy.color },
      },
      {
        table: 'route_template_stops',
        values: [
          {
            id: copy.stops[0].id,
            route_template_id: copy.id,
            sequence: 1,
            locality: 'Valencia',
            meeting_point: 'Estación',
            map_url: 'https://maps.example/valencia',
            minutes_to_next: 25,
            stop_alias: 'Centro',
            street: 'Calle Mayor',
            street_number: '12',
            floor: '1º',
            postal_code: '46001',
            province: 'Valencia',
            country: 'España',
            latitude: 39.47,
            longitude: -0.37,
          },
        ],
      },
    ])
  })
})
