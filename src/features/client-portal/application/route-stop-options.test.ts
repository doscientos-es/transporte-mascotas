import { describe, expect, it } from 'vitest'

import {
  deliveryOptions,
  pickupOptions,
  routeSelectionError,
  suggestedPartyCities,
} from './route-stop-options'

describe('pickupOptions', () => {
  it('lists every stop except the last', () => {
    expect(pickupOptions(['A', 'B', 'C', 'D'])).toEqual(['A', 'B', 'C'])
  })

  it('does not repeat localities that appear in several stops', () => {
    expect(pickupOptions(['A', 'B', 'B', 'C', 'D'])).toEqual(['A', 'B', 'C'])
  })

  it('keeps the base when the route returns to it', () => {
    expect(pickupOptions(['A', 'B', 'C', 'A'])).toEqual(['A', 'B', 'C'])
  })

  it('handles empty and single-stop routes', () => {
    expect(pickupOptions([])).toEqual([])
    expect(pickupOptions(['A'])).toEqual([])
  })
})

describe('deliveryOptions', () => {
  const route = ['A', 'B', 'C', 'D']

  it('lists only the stops after the pickup', () => {
    expect(deliveryOptions(route, 'A')).toEqual(['B', 'C', 'D'])
    expect(deliveryOptions(route, 'B')).toEqual(['C', 'D'])
    expect(deliveryOptions(route, 'C')).toEqual(['D'])
  })

  it('excludes earlier stops', () => {
    expect(deliveryOptions(route, 'C')).not.toContain('A')
    expect(deliveryOptions(route, 'C')).not.toContain('B')
  })

  it('has no delivery after the last stop', () => {
    expect(deliveryOptions(route, 'D')).toEqual([])
  })

  it('does not repeat localities that appear in several stops', () => {
    expect(deliveryOptions(['A', 'B', 'B', 'C', 'C', 'D'], 'A')).toEqual(['B', 'C', 'D'])
  })

  it('uses the first occurrence of a repeated pickup and never offers the pickup itself', () => {
    expect(deliveryOptions(['A', 'B', 'A', 'C'], 'A')).toEqual(['B', 'C'])
  })

  it('offers the return to the base from an intermediate stop', () => {
    expect(deliveryOptions(['A', 'B', 'C', 'A'], 'B')).toEqual(['C', 'A'])
  })

  it('returns nothing without a valid pickup', () => {
    expect(deliveryOptions(route, '')).toEqual([])
    expect(deliveryOptions(route, 'Z')).toEqual([])
  })
})

describe('routeSelectionError', () => {
  const routes = [{ id: 'r1', serviceDate: '2026-10-10', localities: ['A', 'B', 'C', 'A'] }]
  const ok = { dailyRouteId: 'r1', origin: 'A', destination: 'C', desiredDate: '2026-10-10' }

  it('accepts a valid selection', () => {
    expect(routeSelectionError(routes, ok)).toBe('')
    expect(routeSelectionError(routes, { ...ok, origin: 'B', destination: 'A' })).toBe('')
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
