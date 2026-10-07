import { describe, expect, it } from 'vitest'

import { drawCarriageLetter, type LayoutLetter } from './carriage-letter-layout'

const letter = (transport_box_number: number | null): LayoutLetter => ({
  id: 'CARTA DE PORTE Nº 2026-P00001',
  sender_name: '',
  sender_nif: '',
  sender_phone: '',
  sender_email: '',
  sender_address: '',
  sender_postal_code: '',
  sender_city: '',
  sender_province: '',
  recipient_name: '',
  recipient_nif: '',
  recipient_phone: '',
  recipient_email: '',
  recipient_address: '',
  recipient_postal_code: '',
  recipient_city: '',
  recipient_province: '',
  origin_text: '',
  destination_text: '',
  origin_point: '',
  destination_point: '',
  accompanying_documents: [],
  transport_box_number,
  animals: [],
})

describe('carriage letter layout', () => {
  it('prints the assigned transport box number without replacing the vehicle number', () => {
    const texts: string[] = []

    drawCarriageLetter(
      {
        rect: () => {},
        text: (value) => texts.push(value),
        width: (value) => value.length,
      },
      letter(17),
    )

    expect(texts).toContain('BOX TRANSPORTE Nº 17')
    expect(texts).toContain('Nº BÓXER')
    expect(texts).toContain('ATES 01140700097')
  })

  it('omits the transport box label when no van assignment is available', () => {
    const texts: string[] = []

    drawCarriageLetter(
      {
        rect: () => {},
        text: (value) => texts.push(value),
        width: (value) => value.length,
      },
      letter(null),
    )

    expect(texts.some((value) => value.startsWith('BOX TRANSPORTE Nº'))).toBe(false)
  })
})
