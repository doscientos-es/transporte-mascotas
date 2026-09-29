import { describe, expect, it } from 'vitest'

import type { DailyRoute } from '@/shared/types'

import { letterRouteOptions, sortRoutesByDate } from './route-order'

const route = (id: string, date: string): DailyRoute => ({
  id,
  date,
  templateId: 'template',
  status: 'activa',
  actions: [],
})

describe('sortRoutesByDate', () => {
  it('puts the newest route first by default', () => {
    expect(
      sortRoutesByDate([route('old', '2026-09-07'), route('new', '2026-09-10')]).map(
        (item) => item.id,
      ),
    ).toEqual(['new', 'old'])
  })

  it('keeps ascending order available when requested', () => {
    expect(
      sortRoutesByDate([route('old', '2026-09-07'), route('new', '2026-09-10')], 'asc').map(
        (item) => item.id,
      ),
    ).toEqual(['old', 'new'])
  })
})

describe('letterRouteOptions', () => {
  const now = new Date('2026-09-29T10:00:00Z')
  const routes = [
    route('stale', '2026-09-23'),
    route('recent', '2026-09-24'),
    route('today', '2026-09-29'),
    route('future', '2026-10-03'),
  ]

  it('lists newest routes first and hides those older than five days', () => {
    expect(letterRouteOptions(routes, { now }).map((item) => item.id)).toEqual([
      'future',
      'today',
      'recent',
    ])
  })

  it('keeps the route already linked to the letter', () => {
    expect(
      letterRouteOptions(routes, { now, keepRouteId: 'stale' }).map((item) => item.id),
    ).toEqual(['future', 'today', 'recent', 'stale'])
  })
})
