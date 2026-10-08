import { describe, expect, it } from 'vitest'

import { shouldShareVanBox } from './van'

describe('shouldShareVanBox', () => {
  it('shares a target box that is occupied by another assignment', () => {
    expect(shouldShareVanBox(8, 5, [8, 12])).toBe(true)
  })

  it('does not share when keeping the current box or moving to a free box', () => {
    expect(shouldShareVanBox(5, 5, [5])).toBe(false)
    expect(shouldShareVanBox(9, 5, [5, 12])).toBe(false)
  })
})