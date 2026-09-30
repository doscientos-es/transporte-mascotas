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
      minimumTransportBoxCategory({ weightKg: 2, lengthCm: 30, heightCm: 28, widthCm: 40 }),
    ).toBe('pequeno')
    expect(
      minimumTransportBoxCategory({ weightKg: 8, lengthCm: 40, heightCm: 30, widthCm: 45 }),
    ).toBe('mediano')
    expect(
      minimumTransportBoxCategory({ weightKg: 15, lengthCm: 40, heightCm: 40, widthCm: 45 }),
    ).toBe('grande')
  })

  it('picks the box by weight: up to 2.5 kg, up to 13 kg, above that grande', () => {
    const size = { lengthCm: 30, heightCm: 28, widthCm: 40 }
    expect(minimumTransportBoxCategory({ weightKg: 2.5, ...size })).toBe('pequeno')
    expect(minimumTransportBoxCategory({ weightKg: 2.6, ...size })).toBe('mediano')
    expect(minimumTransportBoxCategory({ weightKg: 13, ...size })).toBe('mediano')
    expect(minimumTransportBoxCategory({ weightKg: 13.5, ...size })).toBe('grande')
  })

  it('uses the box sizes configured in the catalog', () => {
    const catalog = {
      ...defaultTransportBoxCatalog,
      pequeno: { ...defaultTransportBoxCatalog.pequeno, maxLengthCm: 45 },
    }
    const animal = { weightKg: 2, lengthCm: 40, heightCm: 28, widthCm: 40 }
    expect(minimumTransportBoxCategory(animal)).toBe('mediano')
    expect(minimumTransportBoxCategory(animal, catalog)).toBe('pequeno')
  })

  it('uses the configured maximum weight of each box', () => {
    const catalog = {
      ...defaultTransportBoxCatalog,
      pequeno: { ...defaultTransportBoxCatalog.pequeno, nextBoxFromKg: 10 },
    }
    const animal = { weightKg: 8, lengthCm: 30, heightCm: 28, widthCm: 40 }
    expect(minimumTransportBoxCategory(animal)).toBe('mediano')
    expect(minimumTransportBoxCategory(animal, catalog)).toBe('pequeno')
  })

  it('only offers the minimum category or a larger comfort option', () => {
    expect(transportBoxOptions('mediano')).toEqual(['mediano', 'grande', 'paso_rueda'])
  })

  it('hides the wheel-arch box for animals heavier than 40 kg', () => {
    expect(transportBoxOptions('mediano', 40)).toContain('paso_rueda')
    expect(transportBoxOptions('mediano', 40.5)).toEqual(['mediano', 'grande'])
    expect(
      requestedTransportBoxCategory({
        weightKg: 45,
        lengthCm: 40,
        heightCm: 30,
        widthCm: 45,
        requestedBoxCategory: 'paso_rueda',
      }),
    ).toBe('grande')
  })

  it('uses the large tariff only above 40 kg', () => {
    const price = (category: 'grande' | 'paso_rueda', weightKg: number) =>
      transportBoxPriceCents(category, { weightKg }, defaultTransportBoxCatalog)
    expect(price('grande', 40)).toBe(15000)
    expect(price('grande', 41)).toBe(18000)
    expect(price('paso_rueda', 20)).toBe(15000)
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
    ).toBe(12000 + 15000 + 18000)
  })
})
