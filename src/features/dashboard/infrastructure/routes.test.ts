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
      delete: () => {
        const query = Promise.resolve({ error: null }) as Promise<{ error: null }> & {
          eq: (_column: string, id: string) => typeof query
        }
        query.eq = (_column, id) => {
          deletes.push({ table, id })
          return query
        }
        return query
      },
    }),
  }),
}))

import {
  deleteRouteTemplateStop,
  duplicateRouteTemplate,
  updateDailyRouteStops,
  updateRouteTemplateStop,
  updateRouteTemplateStopTimes,
} from './routes'

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

  it('duplicates the route in reverse and moves travel times to their reversed legs', async () => {
    inserts.length = 0
    const original: RouteTemplate = {
      id: 'source-template',
      name: 'Levante',
      color: '#123456',
      stops: [
        { id: 'stop-a', locality: 'Alicante', place: '', mapUrl: '', minutes: 10 },
        { id: 'stop-b', locality: 'Valencia', place: '', mapUrl: '', minutes: 20 },
        { id: 'stop-c', locality: 'Barcelona', place: '', mapUrl: '', minutes: 0 },
      ],
    }

    const copy = await duplicateRouteTemplate(original, 'Levante (copia inversa)', 'inversa')

    expect(copy.stops.map(({ locality }) => locality)).toEqual([
      'Barcelona',
      'Valencia',
      'Alicante',
    ])
    expect(copy.stops.map(({ minutes }) => minutes)).toEqual([20, 10, 0])
    expect(
      copy.stops.every(
        (stop) => !original.stops.some((originalStop) => originalStop.id === stop.id),
      ),
    ).toBe(true)
    expect(inserts[1]).toMatchObject({
      table: 'route_template_stops',
      values: [
        { sequence: 1, locality: 'Barcelona', minutes_to_next: 20 },
        { sequence: 2, locality: 'Valencia', minutes_to_next: 10 },
        { sequence: 3, locality: 'Alicante', minutes_to_next: null },
      ],
    })
  })
})

describe('route template stop editing', () => {
  it('updates the stop details without changing its id or sequence', async () => {
    updates.length = 0
    await updateRouteTemplateStop('template-1', {
      id: 'stop-1',
      locality: 'Badalona',
      place: 'Estación',
      mapUrl: 'https://maps.example/badalona',
      minutes: 20,
      alias: 'Centro',
      street: 'Calle Mayor',
      streetNumber: '12',
      floor: '1º',
      postalCode: '08911',
      province: 'Barcelona',
      country: 'España',
      latitude: 41.45,
      longitude: 2.25,
    })

    expect(updates).toEqual([
      {
        locality: 'Badalona',
        meeting_point: 'Estación',
        map_url: 'https://maps.example/badalona',
        minutes_to_next: 20,
        stop_alias: 'Centro',
        street: 'Calle Mayor',
        street_number: '12',
        floor: '1º',
        postal_code: '08911',
        province: 'Barcelona',
        country: 'España',
        latitude: 41.45,
        longitude: 2.25,
      },
    ])
  })

  it('deletes a stop scoped to its template', async () => {
    deletes.length = 0
    await deleteRouteTemplateStop('template-1', 'stop-1')

    expect(deletes).toEqual([
      { table: 'route_template_stops', id: 'stop-1' },
      { table: 'route_template_stops', id: 'template-1' },
    ])
  })

  it('updates only the travel times for stops scoped to their template', async () => {
    updates.length = 0
    await updateRouteTemplateStopTimes('template-1', [
      { ...stop('stop-1'), minutes: 25 },
      { ...stop('stop-2'), minutes: 0 },
    ])

    expect(updates).toEqual([{ minutes_to_next: 25 }, { minutes_to_next: null }])
  })
})
