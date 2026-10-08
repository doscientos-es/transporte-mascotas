import { describe, expect, it } from 'vitest'

import { approximateArrivalPeriod } from './route-arrival-window'

describe('approximateArrivalPeriod', () => {
  it.each([
    ['06:00', 'por la mañana'],
    ['11:59', 'por la mañana'],
    ['12:00', 'al mediodía'],
    ['14:59', 'al mediodía'],
    ['15:00', 'por la tarde'],
    ['19:59', 'por la tarde'],
    ['20:00', 'por la noche'],
    ['00:15', 'por la noche'],
    ['05:59', 'por la noche'],
  ])('maps %s to %s', (time, period) => {
    expect(approximateArrivalPeriod(time)).toBe(period)
  })
})
