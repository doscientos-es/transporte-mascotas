import { describe, expect, it } from 'vitest'

import { approximateArrivalPeriod } from './route-arrival-window'

describe('approximateArrivalPeriod', () => {
  it.each([
    ['06:00', 'mañana (06:00–12:00)'],
    ['11:59', 'mañana (06:00–12:00)'],
    ['12:00', 'mediodía (12:00–15:00)'],
    ['14:59', 'mediodía (12:00–15:00)'],
    ['15:00', 'tarde (15:00–21:00)'],
    ['20:59', 'tarde (15:00–21:00)'],
    ['21:00', 'noche (21:00–00:00)'],
    ['23:59', 'noche (21:00–00:00)'],
    ['00:00', 'madrugada (00:00–06:00)'],
    ['00:15', 'madrugada (00:00–06:00)'],
    ['05:59', 'madrugada (00:00–06:00)'],
  ])('maps %s to %s', (time, period) => {
    expect(approximateArrivalPeriod(time)).toBe(period)
  })
})
