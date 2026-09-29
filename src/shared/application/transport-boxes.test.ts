import { describe, expect, it } from 'vitest'

import {
  defaultTransportBoxCatalog,
  minimumTransportBoxCategory,
  requestedTransportBoxCategory,
  transportAnimalsTotalCents,
  transportBoxOptions,
  transportBoxPriceCents,
} from './transport-boxes'

describe('transport box categories', () => {
  it('assigns the minimum category from the largest relevant measurement', () => {
    expect(
      minimumTransportBoxCategory({ weightKg: 8, lengthCm: 30, heightCm: 28, widthCm: 40 }),
    ).toBe('pequeno')
    expect(
      minimumTransportBoxCategory({ weightKg: 8, lengthCm: 40, heightCm: 30, widthCm: 45 }),
    ).toBe('mediano')
    expect(
      minimumTransportBoxCategory({ weightKg: 50, lengthCm: 40, heightCm: 40, widthCm: 45 }),
    ).toBe('grande')
  })

  it('uses the box sizes configured in the catalog', () => {
    const catalog = {
      ...defaultTransportBoxCatalog,
      pequeno: { ...defaultTransportBoxCatalog.pequeno, maxLengthCm: 45 },
    }
    const animal = { weightKg: 8, lengthCm: 40, heightCm: 28, widthCm: 40 }
    expect(minimumTransportBoxCategory(animal)).toBe('mediano')
    expect(minimumTransportBoxCategory(animal, catalog)).toBe('pequeno')
  })

  it('moves to the next box from the configured weight', () => {
    const catalog = {
      ...defaultTransportBoxCatalog,
      pequeno: { ...defaultTransportBoxCatalog.pequeno, nextBoxFromKg: 10 },
    }
    const animal = { weightKg: 10, lengthCm: 30, heightCm: 28, widthCm: 40 }
    expect(minimumTransportBoxCategory(animal)).toBe('pequeno')
    expect(minimumTransportBoxCategory(animal, catalog)).toBe('mediano')
  })

  it('only offers the minimum category or a larger comfort option', () => {
    expect(transportBoxOptions('mediano')).toEqual(['mediano', 'grande', 'paso_rueda'])
  })

  it('hides the wheel-arch box for animals heavier than 35 kg', () => {
    expect(transportBoxOptions('mediano', 35)).toContain('paso_rueda')
    expect(transportBoxOptions('mediano', 35.5)).toEqual(['mediano', 'grande'])
    expect(
      requestedTransportBoxCategory({
        weightKg: 40,
        lengthCm: 40,
        heightCm: 30,
        widthCm: 45,
        requestedBoxCategory: 'paso_rueda',
      }),
    ).toBe('mediano')
  })

  it('uses the large tariff for heavy animals', () => {
    expect(
      transportBoxPriceCents(
        'grande',
        { weightKg: 50, minimumCategory: 'grande' },
        defaultTransportBoxCatalog,
      ),
    ).toBe(18000)
  })

  it('falls back to the minimum box when the requested one is too small', () => {
    expect(
      requestedTransportBoxCategory({
        weightKg: 8,
        lengthCm: 40,
        heightCm: 30,
        widthCm: 45,
        requestedBoxCategory: 'pequeno',
      }),
    ).toBe('mediano')
  })

  it('adds up the price of every animal with the requested boxes', () => {
    expect(
      transportAnimalsTotalCents(
        [
          { weightKg: 8, lengthCm: 30, heightCm: 28, widthCm: 40 },
          { weightKg: 8, lengthCm: 30, heightCm: 28, widthCm: 40, requestedBoxCategory: 'grande' },
          { weightKg: 55, lengthCm: 90, heightCm: 70, widthCm: 50 },
        ],
        defaultTransportBoxCatalog,
      ),
    ).toBe(10000 + 15000 + 18000)
  })
})
