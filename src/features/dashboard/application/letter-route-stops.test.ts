import { describe, expect, it } from 'vitest'

import {
  labelledRouteStops,
  letterDestinationOptions,
  letterOriginOptions,
  withLetterOrigin,
} from './letter-route-stops'

describe('letter route stop options', () => {
  const stops = ['Madrid', 'Zaragoza', 'Barcelona', 'Girona'].map((locality, index) => ({
    id: String(index),
    locality,
  }))

  it('allows any origin except the last stop, keeping route order', () => {
    expect(letterOriginOptions(stops).map((stop) => stop.locality)).toEqual([
      'Madrid',
      'Zaragoza',
      'Barcelona',
    ])
  })

  it('offers only the stops after the selected origin, keeping route order', () => {
    expect(letterDestinationOptions(stops, '1').map((stop) => stop.locality)).toEqual([
      'Barcelona',
      'Girona',
    ])
    expect(letterDestinationOptions(stops, '2').map((stop) => stop.locality)).toEqual(['Girona'])
  })

  it('offers no destinations until the origin is valid', () => {
    expect(letterDestinationOptions(stops, '')).toEqual([])
    expect(letterDestinationOptions(stops, 'Unknown')).toEqual([])
    expect(letterDestinationOptions(stops, '3')).toEqual([])
  })

  it('preserves the selected destination when changing or clearing the origin', () => {
    const draft = {
      origin: 'Madrid',
      originStopId: '0',
      destination: 'Barcelona',
      destinationStopId: '2',
    }
    const valid = withLetterOrigin(draft, stops[1])
    const invalid = withLetterOrigin(draft, stops[2])
    const cleared = withLetterOrigin(draft, undefined)

    for (const updated of [valid, invalid, cleared]) {
      expect(updated.destination).toBe('Barcelona')
      expect(updated.destinationStopId).toBe('2')
    }
    expect(valid.originStopId).toBe('1')
    expect(
      letterDestinationOptions(stops, valid.originStopId).some((stop) => stop.id === '2'),
    ).toBe(true)
    expect(
      letterDestinationOptions(stops, invalid.originStopId).some((stop) => stop.id === '2'),
    ).toBe(false)
    expect(cleared.originStopId).toBe('')
    expect(draft.originStopId).toBe('0')
  })

  it('keeps repeated stops as distinct choices with their position', () => {
    const repeatedStops = [
      { id: 'madrid-first', locality: 'Madrid' },
      { id: 'zaragoza', locality: 'Zaragoza' },
      { id: 'madrid-second', locality: 'Madrid' },
      { id: 'barcelona', locality: 'Barcelona' },
    ]

    expect(letterOriginOptions(repeatedStops)).toEqual([
      { id: 'madrid-first', locality: 'Madrid', label: 'Madrid · parada 1' },
      { id: 'zaragoza', locality: 'Zaragoza', label: 'Zaragoza' },
      { id: 'madrid-second', locality: 'Madrid', label: 'Madrid · parada 3' },
    ])
    expect(letterDestinationOptions(repeatedStops, 'madrid-first')[1]).toEqual({
      id: 'madrid-second',
      locality: 'Madrid',
      label: 'Madrid · parada 3',
    })
    expect(labelledRouteStops(repeatedStops).map((stop) => stop.label)).toEqual([
      'Madrid · parada 1',
      'Zaragoza',
      'Madrid · parada 3',
      'Barcelona',
    ])
  })
})
