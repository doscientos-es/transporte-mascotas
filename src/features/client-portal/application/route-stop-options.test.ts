import { describe, expect, it } from 'vitest'

import { deliveryOptions, pickupOptions } from './route-stop-options'

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
