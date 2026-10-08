import { describe, expect, it } from 'vitest'

import {
  deliveryOptions,
  pickupOptions,
  routeSelectionError,
  suggestedPartyCities,
} from './route-stop-options'

describe('pickupOptions', () => {
  it('lists every stop except the last and identifies repeated localities by route position', () => {
    expect(
      pickupOptions([
        { id: 'a1', locality: 'A' },
        { id: 'b', locality: 'B' },
        { id: 'a2', locality: 'A' },
        { id: 'c', locality: 'C' },
      ]),
    ).toEqual([
      { id: 'a1', locality: 'A', label: 'A · parada 1' },
      { id: 'b', locality: 'B', label: 'B' },
      { id: 'a2', locality: 'A', label: 'A · parada 3' },
    ])
  })

  it('handles empty and single-stop routes', () => {
    expect(pickupOptions([])).toEqual([])
    expect(pickupOptions([{ id: 'a', locality: 'A' }])).toEqual([])
  })
})

describe('deliveryOptions', () => {
  const route = ['A', 'B', 'C', 'D'].map((locality, index) => ({
    id: String(index),
    locality,
  }))

  it('lists only the stops after the pickup', () => {
    expect(deliveryOptions(route, '0').map((stop) => stop.locality)).toEqual(['B', 'C', 'D'])
    expect(deliveryOptions(route, '1').map((stop) => stop.locality)).toEqual(['C', 'D'])
    expect(deliveryOptions(route, '2').map((stop) => stop.locality)).toEqual(['D'])
  })

  it('excludes earlier stops', () => {
    expect(deliveryOptions(route, '2').map((stop) => stop.locality)).not.toContain('A')
    expect(deliveryOptions(route, '2').map((stop) => stop.locality)).not.toContain('B')
  })

  it('has no delivery after the last stop', () => {
    expect(deliveryOptions(route, '3')).toEqual([])
  })

  it('allows a later occurrence of the pickup locality as a delivery', () => {
    const repeatedRoute = [
      { id: 'a1', locality: 'A' },
      { id: 'b', locality: 'B' },
      { id: 'a2', locality: 'A' },
      { id: 'c', locality: 'C' },
    ]
    expect(deliveryOptions(repeatedRoute, 'a1')).toEqual([
      { id: 'b', locality: 'B', label: 'B' },
      { id: 'a2', locality: 'A', label: 'A · parada 3' },
      { id: 'c', locality: 'C', label: 'C' },
    ])
    expect(deliveryOptions(repeatedRoute, 'a2').map((stop) => stop.locality)).toEqual(['C'])
  })

  it('returns nothing without a valid pickup', () => {
    expect(deliveryOptions(route, '')).toEqual([])
    expect(deliveryOptions(route, 'Z')).toEqual([])
  })
})

describe('routeSelectionError', () => {
  const routes = [
    {
      id: 'r1',
      serviceDate: '2026-10-10',
      localities: ['A', 'B', 'C', 'A'],
      stops: [
        { id: 'a1', locality: 'A' },
        { id: 'b', locality: 'B' },
        { id: 'c', locality: 'C' },
        { id: 'a2', locality: 'A' },
      ],
    },
  ]
  const ok = { dailyRouteId: 'r1', origin: 'A', destination: 'C', desiredDate: '2026-10-10' }

  it('accepts a valid selection', () => {
    expect(routeSelectionError(routes, ok)).toBe('')
    expect(routeSelectionError(routes, { ...ok, origin: 'B', destination: 'A' })).toBe('')
    expect(
      routeSelectionError(routes, {
        ...ok,
        origin: 'A',
        destination: 'A',
        originStopId: 'a1',
        destinationStopId: 'a2',
      }),
    ).toBe('')
  })

  it('requires every field', () => {
    for (const key of Object.keys(ok) as (keyof typeof ok)[])
      expect(routeSelectionError(routes, { ...ok, [key]: '' })).toMatch(/Selecciona una ruta/)
  })

  it('rejects an unknown route or a changed date', () => {
    expect(routeSelectionError(routes, { ...ok, dailyRouteId: 'x' })).toMatch(/ya no está/)
    expect(routeSelectionError(routes, { ...ok, desiredDate: '2026-10-11' })).toMatch(/ya no está/)
  })

  it('rejects delivery equal to or before the pickup, and unknown stops', () => {
    expect(routeSelectionError(routes, { ...ok, destination: 'A' })).toMatch(/posterior/)
    expect(routeSelectionError(routes, { ...ok, origin: 'C', destination: 'B' })).toMatch(
      /posterior/,
    )
    expect(routeSelectionError(routes, { ...ok, origin: 'Z' })).toMatch(/posterior/)
    expect(routeSelectionError(routes, { ...ok, destination: 'Z' })).toMatch(/posterior/)
    expect(
      routeSelectionError(routes, {
        ...ok,
        origin: 'A',
        destination: 'B',
        originStopId: 'a2',
        destinationStopId: 'b',
      }),
    ).toMatch(/posterior/)
  })
})

describe('suggestedPartyCities', () => {
  const none = { senderCity: '', recipientCity: '' }

  it('fills empty cities from the route', () => {
    expect(suggestedPartyCities(none, none, { origin: 'A', destination: 'B' })).toEqual({
      senderCity: 'A',
      recipientCity: 'B',
    })
  })

  it('keeps what the client typed', () => {
    const typed = { senderCity: 'Mi pueblo', recipientCity: 'Otro' }
    expect(suggestedPartyCities(typed, none, { origin: 'A', destination: 'B' })).toEqual(typed)
  })

  it('replaces a previous suggestion when the route changes', () => {
    const previous = { senderCity: 'A', recipientCity: 'B' }
    expect(suggestedPartyCities(previous, previous, { origin: 'C', destination: 'D' })).toEqual({
      senderCity: 'C',
      recipientCity: 'D',
    })
  })
})
