export type Coordinates = { latitude: number; longitude: number }

function radians(value: number) {
  return (value * Math.PI) / 180
}

export function distanceInKm(from: Coordinates, to: Coordinates) {
  const earthRadiusKm = 6371
  const latitudeDelta = radians(to.latitude - from.latitude)
  const longitudeDelta = radians(to.longitude - from.longitude)
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

export function closestStop<T extends { coordinates: Coordinates }>(
  clientLocation: Coordinates,
  stops: T[],
) {
  return stops.reduce<T | null>((closest, stop) => {
    if (!closest) return stop
    return distanceInKm(clientLocation, stop.coordinates) <
      distanceInKm(clientLocation, closest.coordinates)
      ? stop
      : closest
  }, null)
}

export function findNearestPickupStop(
  clientLocation: Coordinates,
  stops: Array<{ locality: string; latitude?: number; longitude?: number }>,
) {
  const candidates = stops.slice(0, -1).flatMap((stop) =>
    typeof stop.latitude === 'number' && typeof stop.longitude === 'number'
      ? [
          {
            locality: stop.locality,
            coordinates: { latitude: stop.latitude, longitude: stop.longitude },
          },
        ]
      : [],
  )
  return closestStop(clientLocation, candidates)?.locality ?? null
}

export function getCurrentLocation() {
  return new Promise<Coordinates>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('La geolocalización no está disponible.'))
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => reject(new Error('No se ha podido obtener tu ubicación.')),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    )
  })
}
