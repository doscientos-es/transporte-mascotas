export type Coordinates = { latitude: number; longitude: number }

type PhotonFeature = { geometry?: { coordinates?: [number, number] } }

const coordinatesByLocality = new Map<string, Promise<Coordinates | null>>()

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

function coordinatesForLocality(locality: string) {
  const key = locality.trim().toLocaleLowerCase()
  const cached = coordinatesByLocality.get(key)
  if (cached) return cached

  const request = fetch(
    `https://photon.komoot.io/api/?${new URLSearchParams({ q: `${locality}, España`, limit: '1' })}`,
  )
    .then(async (response) => {
      if (!response.ok) return null
      const result = (await response.json()) as { features?: PhotonFeature[] }
      const [longitude, latitude] = result.features?.[0]?.geometry?.coordinates ?? []
      if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      )
        return null
      return { latitude, longitude }
    })
    .catch(() => null)
  coordinatesByLocality.set(key, request)
  return request
}

export async function findNearestPickupStop(clientLocation: Coordinates, localities: string[]) {
  const candidates: Array<{ locality: string; coordinates: Coordinates }> = []
  for (const locality of localities.slice(0, -1)) {
    const coordinates = await coordinatesForLocality(locality)
    if (coordinates) candidates.push({ locality, coordinates })
  }
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
