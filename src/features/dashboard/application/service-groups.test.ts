import { describe, expect, it } from 'vitest'

import type { DailyRoute, DailyRouteStop, ServiceAction } from '@/shared/types'

import { groupedServices } from './service-groups'
import { keyboardInsertionIndex, moveItemAtInsertionIndex } from './stop-order'

const stop = (id: string, actionOrder?: string[]): DailyRouteStop => ({
  id,
  locality: 'Madrid',
  place: '',
  mapUrl: '',
  latitude: 40,
  longitude: -3,
  minutes: 0,
  kind: 'parada',
  dwellMinutes: 15,
  actionOrder,
})
const action = (id: string, overrides: Partial<ServiceAction> = {}): ServiceAction => ({
  id,
  letterId: `letter-${id}`,
  animalId: `animal-${id}`,
  type: 'recogida',
  stop: 'Madrid',
  stopId: 'stop-1',
  customer: id,
  phone: '',
  status: 'pendiente',
  animalLabel: id,
  ...overrides,
})
const route = (actions: ServiceAction[]): DailyRoute => ({
  id: 'route',
  templateId: 'template',
  date: '2026-11-10',
  status: 'activa',
  actions,
})
const ids = (groups: ReturnType<typeof groupedServices>, stopId = 'stop-1') =>
  groups.get(stopId)?.map((group) => group.actions.map((item) => item.id))

describe('groupedServices', () => {
  it('uses a deterministic fallback regardless of the server action order', () => {
    const actions = [action('b'), action('a'), action('c', { type: 'entrega' })]
    const stops = [stop('stop-1')]
    const forward = groupedServices(route(actions), stops, [])
    const reverse = groupedServices(route(actions.toReversed()), stops, [])
    expect(ids(forward)).toEqual(ids(reverse))
    expect(ids(forward)).toHaveLength(3)
    expect(actions.map((item) => item.id)).toEqual(['b', 'a', 'c'])
  })

  it('restores a saved mixed pickup/delivery order after reload', () => {
    const actions = [action('pickup'), action('delivery', { type: 'entrega' }), action('last')]
    const stops = [stop('stop-1', ['delivery', 'pickup', 'last'])]
    expect(ids(groupedServices(route(actions.toReversed()), stops, []))).toEqual([
      ['delivery'],
      ['pickup'],
      ['last'],
    ])
  })

  it('keeps grouped animals together and appends new events after saved events', () => {
    const actions = [
      action('new'),
      action('a', { letterId: 'shared', box: 13 }),
      action('b', { letterId: 'shared', box: 13 }),
      action('other'),
    ]
    const stops = [stop('stop-1', ['deleted', 'other', 'b'])]
    expect(ids(groupedServices(route(actions), stops, []))).toEqual([
      ['other'],
      ['a', 'b'],
      ['new'],
    ])
  })

  it('orders repeated localities independently by stop id and does not mix boxes or event types', () => {
    const actions = [
      action('a', { letterId: 'shared', box: 13 }),
      action('b', { letterId: 'shared', box: 14 }),
      action('c', { letterId: 'shared', type: 'entrega', box: 13 }),
      action('d', { stopId: 'stop-2' }),
      action('e', { stopId: 'stop-2' }),
    ]
    const groups = groupedServices(
      route(actions),
      [stop('stop-1', ['b', 'c', 'a']), stop('stop-2', ['e', 'd'])],
      [],
    )
    expect(ids(groups)).toEqual([['b'], ['c'], ['a']])
    expect(ids(groups, 'stop-2')).toEqual([['e'], ['d']])
  })

  it('serializes the same whole-card order for pointer, keyboard and button moves', () => {
    const actions = [
      action('a', { letterId: 'shared' }),
      action('b', { letterId: 'shared' }),
      action('c'),
    ]
    const groups = groupedServices(route(actions), [stop('stop-1')], []).get('stop-1') ?? []
    const destination = keyboardInsertionIndex(0, 'down', groups.length)
    expect(destination).toBe(2)
    if (destination === null) throw new Error('Expected a valid movement')
    const moved = moveItemAtInsertionIndex(groups, 0, destination)
    const savedIds = moved.flatMap((group) => group.actions.map((item) => item.id))
    expect(
      ids(groupedServices(route(actions.toReversed()), [stop('stop-1', savedIds)], [])),
    ).toEqual(moved.map((group) => group.actions.map((item) => item.id)))
    expect(savedIds).toHaveLength(3)
  })
})
