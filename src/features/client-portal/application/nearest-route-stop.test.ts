import { describe, expect, it } from 'vitest'

import { closestStop, distanceInKm, findNearestPickupStop } from './nearest-route-stop'

describe('closestStop', () => {
  it('selects the stop with the shortest geodesic distance', () => {
    const clientLocation = { latitude: 40.4168, longitude: -3.7038 }
    const stops = [
      { locality: 'Valencia', coordinates: { latitude: 39.4699, longitude: -0.3763 } },
      { locality: 'Getafe', coordinates: { latitude: 40.3083, longitude: -3.7327 } },
    ]

    expect(closestStop(clientLocation, stops)?.locality).toBe('Getafe')
    expect(distanceInKm(clientLocation, stops[1].coordinates)).toBeLessThan(20)
  })

  it('ignores stops without exact coordinates and excludes the final stop from pickup', () => {
    const nearest = findNearestPickupStop({ latitude: 40.4168, longitude: -3.7038 }, [
      { id: 'no-location', locality: 'Sin coordenadas' },
      { id: 'getafe', locality: 'Getafe', latitude: 40.3083, longitude: -3.7327 },
      { id: 'madrid', locality: 'Madrid', latitude: 40.4168, longitude: -3.7038 },
    ])

    expect(nearest?.locality).toBe('Getafe')
    expect(nearest?.id).toBe('getafe')
  })

  it('keeps the identity of the nearest stop when the locality repeats', () => {
    const nearest = findNearestPickupStop({ latitude: 40, longitude: -3 }, [
      { id: 'first', locality: 'Madrid', latitude: 41, longitude: -3 },
      { id: 'second', locality: 'Madrid', latitude: 40, longitude: -3 },
      { id: 'last', locality: 'Barcelona', latitude: 41, longitude: 2 },
    ])

    expect(nearest?.id).toBe('second')
  })
})
