import { describe, expect, it } from 'vitest'

import { paginate } from './pagination'

describe('paginate', () => {
  it('returns the requested slice and a useful range summary', () => {
    expect(paginate(['a', 'b', 'c', 'd', 'e'], 2, 2)).toEqual({
      items: ['c', 'd'],
      page: 2,
      pageCount: 3,
      firstRecord: 3,
      lastRecord: 4,
    })
  })

  it('clamps empty and out-of-range pages safely', () => {
    expect(paginate(['a'], 8, 2)).toMatchObject({
      items: ['a'],
      page: 1,
      pageCount: 1,
      firstRecord: 1,
      lastRecord: 1,
    })
    expect(paginate([], 0, 2)).toMatchObject({
      items: [],
      page: 1,
      pageCount: 1,
      firstRecord: 0,
      lastRecord: 0,
    })
  })
})
