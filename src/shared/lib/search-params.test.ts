import { describe, expect, it } from 'vitest'

import { readEnumParam, readPageParam, updateSearchParams } from './search-params'

describe('search params', () => {
  it('accepts only positive integer pages', () => {
    expect(readPageParam('4')).toBe(4)
    expect(readPageParam('0')).toBe(1)
    expect(readPageParam('1.5')).toBe(1)
  })

  it('accepts only values from the allowed enum', () => {
    expect(readEnumParam('emitida', ['todas', 'emitida'] as const, 'todas')).toBe('emitida')
    expect(readEnumParam('invalid', ['todas', 'emitida'] as const, 'todas')).toBe('todas')
  })

  it('updates named parameters without dropping unrelated ones', () => {
    expect(
      updateSearchParams(new URLSearchParams('client=1&page=2'), {
        page: 3,
        client: '',
      }).toString(),
    ).toBe('page=3')
  })
})
