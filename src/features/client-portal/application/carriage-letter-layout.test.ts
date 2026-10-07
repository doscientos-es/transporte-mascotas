import { describe, expect, it } from 'vitest'

import { drawCarriageLetter, type LayoutLetter } from './carriage-letter-layout'

const letter = (
  transport_box_number: number | null,
  overrides: Partial<LayoutLetter> = {},
): LayoutLetter => ({
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
  ...overrides,
})

describe('carriage letter layout', () => {
  it('prints a single carriage-letter reference and the assigned box number', () => {
    const texts: string[] = []
    const images: Array<[number, number, number, number]> = []

    drawCarriageLetter(
      {
        rect: () => {},
        text: (value) => texts.push(value),
        width: (value) => value.length,
        image: (_data, x, y, w, h) => images.push([x, y, w, h]),
      },
      letter(17),
      new Uint8Array([1]),
    )

    expect(texts).toContain('CARTA DE PORTE')
    expect(texts).toContain('Nº 2026-P00001')
    expect(texts).toContain('Nº Box: 17')
    expect(texts).not.toContain('CARTA DE PORTE Nº CARTA DE PORTE Nº 2026-P00001')
    expect(texts).not.toContain('Nº BÓXER')
    expect(texts).not.toContain('ATES 01140700097')
    expect(images).toEqual([[8, 5, 22, 22]])
  })

  it('shows an explicit fallback when no transport box is assigned', () => {
    const texts: string[] = []

    drawCarriageLetter(
      {
        rect: () => {},
        text: (value) => texts.push(value),
        width: (value) => value.length,
      },
      letter(null),
    )

    expect(texts).toContain('Nº Box: No especificado')
  })

  it('prints animal birth dates with a fallback and only the stop locality', () => {
    const texts: string[] = []

    drawCarriageLetter(
      {
        rect: () => {},
        text: (value) => texts.push(value),
        width: (value) => value.length,
      },
      letter(17, {
        origin_text: 'Murcia-Puerto Lumbreras',
        origin_point: 'Calle Góngora',
        destination_text: 'Murcia-Murcia',
        destination_point: 'Calle Mayor',
        animals: [
          { species: 'Perro', breed: 'Mestizo', birth_date: '2020-06-12' },
          { species: 'Gato', breed: 'Común', birth_date: null },
        ],
      }),
    )

    expect(texts).toContain('12/06/2020, No especificado')
    expect(texts).toContain('Puerto Lumbreras')
    expect(texts).toContain('Murcia')
    expect(texts).not.toContain('Murcia-Puerto Lumbreras')
    expect(texts).not.toContain('Calle Góngora')
    expect(texts).not.toContain('Calle Mayor')
  })
})
