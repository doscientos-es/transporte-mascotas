import { describe, expect, it } from 'vitest'

import { arrivalMoment, routeDays, routeDaysLabel, routeStopArrivals } from './route-days'

describe('routeDays', () => {
  it('returns one day when there is no later end date', () => {
    expect(routeDays('2026-10-01')).toEqual(['2026-10-01'])
    expect(routeDays('2026-10-01', '2026-10-01')).toEqual(['2026-10-01'])
    expect(routeDays('2026-10-05', '2026-10-01')).toEqual(['2026-10-05'])
  })

  it('lists every day including both ends, across months', () => {
    expect(routeDays('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
  })

  it('caps absurdly long ranges', () => {
    expect(routeDays('2026-01-01', '2026-12-31')).toHaveLength(14)
  })
})

describe('routeDaysLabel', () => {
  it('labels a single day', () => {
    expect(routeDaysLabel('2026-10-01')).toBe('1 de octubre')
  })

  it('joins days of the same month', () => {
    expect(routeDaysLabel('2026-10-01', '2026-10-02')).toBe('1 y 2 de octubre')
    expect(routeDaysLabel('2026-10-01', '2026-10-03')).toBe('1, 2 y 3 de octubre')
  })

  it('groups days by month when the route crosses months', () => {
    expect(routeDaysLabel('2026-10-30', '2026-11-01')).toBe('30 y 31 de octubre y 1 de noviembre')
  })
})

describe('arrivalMoment', () => {
  it('stays on the same day for short offsets', () => {
    expect(arrivalMoment('2026-10-01', '08:00', 90)).toEqual({ date: '2026-10-01', time: '09:30' })
  })

  it('moves to the next days after midnight', () => {
    expect(arrivalMoment('2026-10-01', '22:00', 180)).toEqual({ date: '2026-10-02', time: '01:00' })
    expect(arrivalMoment('2026-10-01', '08:00', 2 * 24 * 60 + 60)).toEqual({
      date: '2026-10-03',
      time: '09:00',
    })
  })

  it('rolls over month ends', () => {
    expect(arrivalMoment('2026-10-31', '23:30', 60)).toEqual({ date: '2026-11-01', time: '00:30' })
  })
})

describe('routeStopArrivals', () => {
  it('assigns the next day to a stop reached after midnight', () => {
    expect(
      routeStopArrivals('2026-10-06', '08:00', [
        { minutes: 960, dwellMinutes: 15 },
        { minutes: 0, dwellMinutes: 0 },
      ]),
    ).toEqual([
      { date: '2026-10-06', time: '08:00' },
      { date: '2026-10-07', time: '00:15' },
    ])
  })
})
