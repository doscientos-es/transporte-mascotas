import { describe, expect, it } from 'vitest'

import { keyboardInsertionIndex, moveItemAtInsertionIndex } from './stop-order'

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

describe('keyboardInsertionIndex', () => {
  it('returns insertion positions for moving one place with the arrow keys', () => {
    expect(keyboardInsertionIndex(1, 'up', 3)).toBe(0)
    expect(keyboardInsertionIndex(0, 'down', 3)).toBe(2)
  })

  it('does not move past either end of the list', () => {
    expect(keyboardInsertionIndex(0, 'up', 3)).toBeNull()
    expect(keyboardInsertionIndex(2, 'down', 3)).toBeNull()
  })
})
