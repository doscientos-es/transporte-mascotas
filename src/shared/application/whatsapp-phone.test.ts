import { describe, expect, it } from 'vitest'

import { isWhatsAppPhone } from './whatsapp-phone'

describe('isWhatsAppPhone', () => {
  it.each(['600 000 000', '+34 600 000 000', '+44 20 7946 0018'])('accepts %s', (phone) => {
    expect(isWhatsAppPhone(phone)).toBe(true)
  })

  it.each(['', '123', '000 000 000', '+34 abc'])('rejects %s', (phone) => {
    expect(isWhatsAppPhone(phone)).toBe(false)
  })
})
