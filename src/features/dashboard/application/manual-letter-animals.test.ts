import { describe, expect, it } from 'vitest'

import type { LetterDraft } from '@/shared/types'

import { validateManualLetterBreeds } from './manual-letter-animals'

const animal = (breed: string): LetterDraft['animals'][number] => ({
  species: 'Canina',
  breed,
  birthDate: '2020-01-01',
  weightKg: 10,
  lengthCm: 0,
  heightCm: 0,
  widthCm: 0,
  size: 'pequeno',
})

describe('validateManualLetterBreeds', () => {
  it('requires a non-blank breed for every animal', () => {
    expect(() => validateManualLetterBreeds([animal('Labrador'), animal('')])).toThrow(
      'Indica la raza de cada mascota.',
    )
    expect(() => validateManualLetterBreeds([animal('  \t')])).toThrow(
      'Indica la raza de cada mascota.',
    )
    expect(() =>
      validateManualLetterBreeds([animal(' Labrador '), animal('Mestizo')]),
    ).not.toThrow()
  })
})
