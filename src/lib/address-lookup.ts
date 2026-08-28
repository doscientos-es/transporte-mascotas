type PhotonFeature = {
  properties?: {
    name?: string
    street?: string
    housenumber?: string
    city?: string
    locality?: string
    postcode?: string
    state?: string
    country?: string
  }
}

export type AddressSuggestion = {
  alias: string
  street: string
  streetNumber: string
  locality: string
  postalCode: string
  province: string
  country: string
}

export async function lookupAddressSuggestions(address: string, signal?: AbortSignal) {
  const query = [address, 'España'].filter(Boolean).join(', ')
  const response = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`,
    { signal },
  )
  if (!response.ok) throw new Error('No se ha podido buscar la dirección.')
  const result = (await response.json()) as { features?: PhotonFeature[] }
  return (result.features ?? [])
    .map(({ properties }) => {
      const item = properties ?? {}
      const streetName = item.street ?? item.name ?? ''
      return {
        alias: item.name && item.name !== streetName ? item.name : '',
        street: streetName,
        streetNumber: item.housenumber ?? '',
        locality: item.city ?? item.locality ?? '',
        postalCode: item.postcode ?? '',
        province: item.state ?? '',
        country: item.country ?? 'España',
      }
    })
    .filter(
      (item, index, items) =>
        item.street &&
        items.findIndex(
          (candidate) =>
            `${candidate.street}:${candidate.streetNumber}` ===
            `${item.street}:${item.streetNumber}`,
        ) === index,
    )
}
