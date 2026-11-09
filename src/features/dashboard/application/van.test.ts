import { describe, expect, it } from 'vitest'

import {
  filterVanAssignments,
  isBoxCompatible,
  shouldShareVanBox,
  vanBoxSizeForAnimal,
} from './van'

describe('filterVanAssignments', () => {
  it('combines box-size, pickup-status, and accent-insensitive text filters', () => {
    const rows = [
      {
        assignment: { box: 5, label: 'Carta Norte', animalCount: 2 },
        pickup: { customer: 'Ana', stop: 'Alcalá', status: 'incidencia' as const },
      },
      {
        assignment: { box: 13, label: 'Carta Sur', animalCount: 1 },
        pickup: { customer: 'Luis', stop: 'Sevilla', status: 'pendiente' as const },
      },
    ]

    expect(
      filterVanAssignments(rows, {
        query: 'alcala',
        boxSize: 'mediano',
        status: 'incidencia',
      }),
    ).toEqual([rows[0]])
  })
})

describe('van box category compatibility', () => {
  it('uses the configured box category instead of the legacy animal size', () => {
    const animal = { size: 'pequeno' as const, boxCategory: 'mediano' as const }

    expect(vanBoxSizeForAnimal(animal)).toBe('mediano')
    expect(isBoxCompatible(15, animal.boxCategory)).toBe(false)
    expect(isBoxCompatible(5, animal.boxCategory)).toBe(true)
    expect(isBoxCompatible(1, animal.boxCategory)).toBe(true)
  })

  it('maps the wheel-arch box to a large van compartment', () => {
    expect(vanBoxSizeForAnimal({ size: 'pequeno', boxCategory: 'paso_rueda' })).toBe('grande')
    expect(isBoxCompatible(5, 'paso_rueda')).toBe(false)
    expect(isBoxCompatible(1, 'paso_rueda')).toBe(true)
  })
})

describe('shouldShareVanBox', () => {
  it('shares a target box that is occupied by another assignment', () => {
    expect(shouldShareVanBox(8, 5, [8, 12])).toBe(true)
  })

  it('does not share when keeping the current box or moving to a free box', () => {
    expect(shouldShareVanBox(5, 5, [5])).toBe(false)
    expect(shouldShareVanBox(9, 5, [5, 12])).toBe(false)
  })
})
