import { describe, expect, it } from 'vitest'

import { isWhatsAppPhone, whatsAppUrl } from './whatsapp-phone'

describe('isWhatsAppPhone', () => {
  it.each(['600 000 000', '+34 600 000 000', '+44 20 7946 0018'])('accepts %s', (phone) => {
    expect(isWhatsAppPhone(phone)).toBe(true)
  })

  it.each(['', '123', '000 000 000', '+34 abc'])('rejects %s', (phone) => {
    expect(isWhatsAppPhone(phone)).toBe(false)
  })
})

describe('whatsAppUrl', () => {
  it.each([
    ['600 000 000', 'https://wa.me/34600000000'],
    ['+34 600 000 000', 'https://wa.me/34600000000'],
    ['0034 600 000 000', 'https://wa.me/34600000000'],
    ['+44 20 7946 0018', 'https://wa.me/442079460018'],
  ])('normalizes %s', (phone, url) => {
    expect(whatsAppUrl(phone)).toBe(url)
  })

  it('encodes the message', () => {
    expect(whatsAppUrl('600000000', 'Hola, ¿qué tal?')).toBe(
      'https://wa.me/34600000000?text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F',
    )
  })

  it('returns null for invalid phones', () => {
    expect(whatsAppUrl('123')).toBeNull()
  })
})
