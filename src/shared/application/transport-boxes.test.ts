import { describe, expect, it } from 'vitest'

import {
  defaultTransportBoxCatalog,
  minimumTransportBoxCategory,
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

  it('only offers the minimum category or a larger comfort option', () => {
    expect(transportBoxOptions('mediano')).toEqual(['mediano', 'grande', 'paso_rueda'])
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
})
