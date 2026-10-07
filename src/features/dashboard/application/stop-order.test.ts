import { describe, expect, it } from 'vitest'

import { moveItemAtInsertionIndex } from './stop-order'

describe('moveItemAtInsertionIndex', () => {
  it('moves a stop across several positions and into the last slot', () => {
    expect(moveItemAtInsertionIndex(['A', 'B', 'C', 'D'], 0, 4)).toEqual(['B', 'C', 'D', 'A'])
  })

  it('moves a stop toward the start of the list', () => {
    expect(moveItemAtInsertionIndex(['A', 'B', 'C', 'D'], 3, 1)).toEqual(['A', 'D', 'B', 'C'])
  })

  it('keeps the list unchanged when the source index is invalid', () => {
    const stops = ['A', 'B']
    expect(moveItemAtInsertionIndex(stops, -1, 1)).toEqual(stops)
    expect(moveItemAtInsertionIndex(stops, 2, 1)).toEqual(stops)
    expect(moveItemAtInsertionIndex(stops, -1, 1)).not.toBe(stops)
  })
})
