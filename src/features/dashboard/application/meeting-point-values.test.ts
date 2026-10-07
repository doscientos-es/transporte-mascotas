import { describe, expect, it } from 'vitest'

import { stopFieldsFromMeetingPoint } from './meeting-point-values'

describe('stopFieldsFromMeetingPoint', () => {
  it('copies the saved address, instructions, and exact coordinates into a stop form', () => {
    expect(
      stopFieldsFromMeetingPoint({
        id: 'meeting-point-1',
        name: 'Gasolinera',
        locality: 'Murcia',
        place: 'Junto a IKEA',
        street: '',
        streetNumber: '',
        floor: '',
        postalCode: '',
        province: '',
        country: 'España',
        latitude: 37.9922,
        longitude: -1.1307,
      }),
    ).toEqual({
      locality: 'Murcia',
      postalCode: '',
      province: '',
      country: 'España',
      street: '',
      streetNumber: '',
      floor: '',
      latitude: '37.9922',
      longitude: '-1.1307',
      indications: 'Junto a IKEA',
    })
  })
})
