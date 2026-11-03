import { describe, expect, it } from 'vitest'

import {
  defaultTransportBoxCatalog,
  transportAnimalsTotalCents,
} from '@/shared/application/transport-boxes'
import type { LetterDraft } from '@/shared/types'

import { manualLetterTotalCents } from './manual-letter-total'

const animals: LetterDraft['animals'] = [
  {
    species: 'Canina',
    breed: 'Mestizo',
    birthDate: '2020-01-01',
    weightKg: 5,
    lengthCm: 30,
    heightCm: 20,
    widthCm: 20,
    size: 'pequeno',
  },
]
const catalog = defaultTransportBoxCatalog

describe('manualLetterTotalCents', () => {
  it('uses the box tariff until an admin chooses an amount', () => {
    expect(manualLetterTotalCents({ animals }, catalog)).toBe(
      transportAnimalsTotalCents(animals, catalog),
    )
  })

  it.each([
    ['1.25', 125],
    ['999.99', 99999],
    ['125,50', 12550],
    [' 12 ', 1200],
    ['0.01', 1],
    ['1.13', 113],
  ])('accepts the admin amount %s instead of the tariff', (billingTotal, expected) => {
    expect(manualLetterTotalCents({ animals, billingTotal }, catalog)).toBe(expected)
  })

  it('keeps the chosen amount when animals and box prices change', () => {
    expect(
      manualLetterTotalCents({ animals: [...animals, ...animals], billingTotal: '25' }, catalog),
    ).toBe(2500)
  })

  it.each(['', ' ', '0', '-10', '1.234', 'NaN', 'Infinity', '1e2', '99999999999999999'])(
    'rejects an invalid amount %j rather than silently using the tariff',
    (billingTotal) => {
      expect(() => manualLetterTotalCents({ animals, billingTotal }, catalog)).toThrow()
    },
  )
})
