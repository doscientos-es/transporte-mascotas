import { describe, expect, it } from 'vitest'

import { drawCarriageLetter as drawCustomerCarriageLetter } from '../../../../supabase/functions/_shared/carriage-letter-layout'
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

describe.each([
  ['client portal', drawCarriageLetter],
  ['customer attachment', drawCustomerCarriageLetter],
] as const)('%s carriage letter layout', (_name, drawLetter) => {
  it('enlarges and centers the logo and prints only the box and ATES beside it', () => {
    const texts: string[] = []
    const textPositions: Array<{ value: string; x: number; align?: string }> = []
    const images: Array<[number, number, number, number]> = []
    const rectangles: Array<[number, number, number, number]> = []

    drawLetter(
      {
        rect: (x, y, w, h) => rectangles.push([x, y, w, h]),
        text: (value, x, _y, { align }) => {
          texts.push(value)
          textPositions.push({ value, x, align })
        },
        width: (value) => value.length,
        image: (_data, x, y, w, h) => images.push([x, y, w, h]),
      },
      letter(17, {
        ates_number: ' ATES01140700097 ',
        animals: [{ species: 'Perro', breed: 'Mestizo', identification: '123456789' }],
      }),
      new Uint8Array([1]),
    )

    expect(texts).toContain('CARTA DE PORTE')
    expect(texts).toContain('Nº 2026-P00001')
    expect(texts).toContain('Nº Box: 17')
    expect(texts).toContain('kacheenvios.com')
    expect(texts).toContain('ATES: ATES01140700097')
    expect(texts.some((value) => value.startsWith('Identificación:'))).toBe(false)
    expect(texts).not.toContain('CARTA DE PORTE Nº CARTA DE PORTE Nº 2026-P00001')
    expect(textPositions).toContainEqual({ value: 'Nº 2026-P00001', x: 10, align: undefined })
    expect(textPositions).toContainEqual({
      value: 'ATES: ATES01140700097',
      x: 198,
      align: 'right',
    })
    expect(images).toEqual([[89, 4.7, 32, 26]])
    expect(rectangles).toContainEqual([4, 4, 202, 30])
    expect(rectangles).toContainEqual([4, 128.7, 101, 15.3])
    expect(rectangles.every(([, y, , height]) => y + height <= 148)).toBe(true)
  })

  it('shows an explicit fallback when no transport box is assigned', () => {
    const texts: string[] = []

    drawLetter(
      {
        rect: () => {},
        text: (value) => texts.push(value),
        width: (value) => value.length,
      },
      letter(null),
    )

    expect(texts).toContain('Nº Box: No especificado')
    expect(texts).not.toContain('Identificación: No especificado')
    expect(texts.some((value) => value.startsWith('ATES:'))).toBe(false)
  })

  it('prints animal birth dates with a fallback and only the stop locality', () => {
    const texts: string[] = []

    drawLetter(
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
