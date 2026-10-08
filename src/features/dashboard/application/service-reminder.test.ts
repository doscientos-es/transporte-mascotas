import { describe, expect, it } from 'vitest'

import { transportReminderMessage } from './service-reminder'

describe('transportReminderMessage', () => {
  it('uses the calendar day of the pickup when it is after midnight', () => {
    const message = transportReminderMessage({
      pickup: { place: 'Madrid', date: '2026-10-07', time: '00:15' },
    })

    expect(message).toContain('HORA DE RECOGIDA EN MADRID (miércoles, 7 de octubre, 00:15)')
  })

  it('adds the Maps link directly after each scheduled date and time', () => {
    const message = transportReminderMessage({
      pickup: {
        place: 'Madrid',
        date: '2026-10-07',
        time: '09:30',
        mapUrl: 'https://maps.example/pickup',
      },
      delivery: {
        place: 'Valencia',
        date: '2026-10-08',
        time: '12:00',
        mapUrl: 'https://maps.example/delivery',
      },
    })

    expect(message).toContain(
      'HORA DE RECOGIDA EN MADRID (miércoles, 7 de octubre, 09:30)\nhttps://maps.example/pickup',
    )
    expect(message).toContain(
      'HORA DE ENTREGA EN VALENCIA (jueves, 8 de octubre, 12:00)\nhttps://maps.example/delivery',
    )
  })
})
