import { describe, expect, it } from 'vitest'

import type { DailyRoute } from '@/shared/types'

import { sortRoutesByDate } from './route-order'

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
