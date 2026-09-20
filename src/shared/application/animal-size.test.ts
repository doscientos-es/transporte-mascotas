import { describe, expect, it } from 'vitest'

import { sizeForMeasurements } from './animal-size'

describe('sizeForMeasurements', () => {
  it('classifies each box size from the largest matching measurement', () => {
    expect(sizeForMeasurements({ weightKg: 5, lengthCm: 30, heightCm: 20 })).toBe('pequeno')
    expect(sizeForMeasurements({ weightKg: 10, lengthCm: 30, heightCm: 20 })).toBe('mediano')
    expect(sizeForMeasurements({ weightKg: 5, lengthCm: 80, heightCm: 20 })).toBe('grande')
  })
})
