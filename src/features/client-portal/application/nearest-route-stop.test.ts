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
      { locality: 'Sin coordenadas' },
      { locality: 'Getafe', latitude: 40.3083, longitude: -3.7327 },
      { locality: 'Madrid', latitude: 40.4168, longitude: -3.7038 },
    ])

    expect(nearest).toBe('Getafe')
  })
})
