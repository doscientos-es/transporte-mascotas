import { describe, expect, it } from 'vitest'

import { transportReminderMessage } from './service-reminder'

describe('transportReminderMessage', () => {
  it('uses the calendar day of the pickup when it is after midnight', () => {
    const message = transportReminderMessage({
      pickup: { place: 'Madrid', date: '2026-10-07', time: '00:15' },
    })

    expect(message).toContain('HORA DE RECOGIDA EN MADRID (miércoles, 7 de octubre, 00:15)')
  })
})
