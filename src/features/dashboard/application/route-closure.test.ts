import { describe, expect, it } from 'vitest'

import { canCloseRouteOn } from './route-closure'

describe('canCloseRouteOn', () => {
  it('allows closing only on the day before the route in Madrid', () => {
    expect(canCloseRouteOn('2026-09-03', new Date('2026-09-02T10:00:00Z'))).toBe(true)
    expect(canCloseRouteOn('2026-09-02', new Date('2026-09-02T10:00:00Z'))).toBe(false)
    expect(canCloseRouteOn('2026-09-04', new Date('2026-09-02T10:00:00Z'))).toBe(false)
  })

  it('uses the Madrid calendar day around UTC midnight', () => {
    expect(canCloseRouteOn('2026-09-04', new Date('2026-09-02T22:30:00Z'))).toBe(true)
  })
})