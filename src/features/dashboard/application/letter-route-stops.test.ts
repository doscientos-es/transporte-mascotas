import { describe, expect, it } from 'vitest'

import { letterDestinationOptions, letterOriginOptions } from './letter-route-stops'

describe('letter route stop options', () => {
  const stops = ['Madrid', 'Zaragoza', 'Barcelona', 'Girona']

  it('allows any origin except the last stop, keeping route order', () => {
    expect(letterOriginOptions(stops)).toEqual(['Madrid', 'Zaragoza', 'Barcelona'])
  })

  it('offers only the stops after the selected origin, keeping route order', () => {
    expect(letterDestinationOptions(stops, 'Zaragoza')).toEqual(['Barcelona', 'Girona'])
    expect(letterDestinationOptions(stops, 'Barcelona')).toEqual(['Girona'])
  })

  it('offers no destinations until the origin is valid', () => {
    expect(letterDestinationOptions(stops, '')).toEqual([])
    expect(letterDestinationOptions(stops, 'Unknown')).toEqual([])
    expect(letterDestinationOptions(stops, 'Girona')).toEqual([])
  })
})
