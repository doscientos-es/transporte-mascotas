import { describe, expect, it } from 'vitest'

import type { Letter } from '@/shared/types'

import { letterToCarriageLetter } from './carriage-letter-pdf'

describe('letterToCarriageLetter', () => {
  it('includes each animal birth date and the assigned transport box number', () => {
    const letter = {
      id: 'CARTA DE PORTE Nº 2026-P00001',
      animals: [
        {
          id: 'animal-1',
          species: 'Perro',
          breed: 'Mestizo',
          identification: '123456789',
          birthDate: '2020-06-12',
          weightKg: 12,
          lengthCm: 40,
          heightCm: 30,
          widthCm: 20,
        },
      ],
    } as unknown as Letter

    const document = letterToCarriageLetter(letter, 17)

    expect(document.transport_box_number).toBe(17)
    expect(document.animals[0]?.birth_date).toBe('2020-06-12')
    expect(document.animals[0]?.identification).toBe('123456789')
  })
})
