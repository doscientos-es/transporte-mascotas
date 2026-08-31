import { describe, expect, it } from 'vitest'

import { sizeForMeasurements } from './animal-size'

describe('sizeForMeasurements', () => {
  it('uses the largest category reached by weight, length or height', () => {
    expect(sizeForMeasurements({ weightKg: 8, lengthCm: 60, heightCm: 30 })).toBe('mediano')
    expect(sizeForMeasurements({ weightKg: 7, lengthCm: 40, heightCm: 65 })).toBe('grande')
  })

  it('keeps small animals below every threshold', () => {
    expect(sizeForMeasurements({ weightKg: 9.9, lengthCm: 54, heightCm: 39 })).toBe('pequeno')
  })
})
