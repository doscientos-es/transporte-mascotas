import type { SavedMeetingPoint } from '@/shared/types'

import { mergedStopInstructions } from './stop-instructions'

export function stopFieldsFromMeetingPoint(point: SavedMeetingPoint) {
  return {
    locality: point.locality,
    postalCode: point.postalCode,
    province: point.province,
    country: point.country,
    street: point.street,
    streetNumber: point.streetNumber,
    floor: point.floor,
    latitude: String(point.latitude),
    longitude: String(point.longitude),
    indications: mergedStopInstructions(point.name, point.place),
  }
}
