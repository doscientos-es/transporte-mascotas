import { describe, expect, it } from 'vitest'

import { toggleSortDirection } from './sort-direction'

describe('toggleSortDirection', () => {
  it('switches between ascending and descending order', () => {
    expect(toggleSortDirection('desc')).toBe('asc')
    expect(toggleSortDirection('asc')).toBe('desc')
  })
})
