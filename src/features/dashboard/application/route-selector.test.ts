import { describe, expect, it } from 'vitest'

import type { DailyRoute, RouteTemplate } from '@/shared/types'

import { groupRoutesForSelector } from './route-selector'

const route = (id: string, date: string, templateId: string): DailyRoute => ({
  id,
  date,
  templateId,
  status: 'activa',
  actions: [],
})

const template = (id: string, name: string): RouteTemplate => ({ id, name, color: '', stops: [] })

describe('groupRoutesForSelector', () => {
  it('groups routes by chronological day and orders each group by route name', () => {
    const groups = groupRoutesForSelector(
      [
        route('later', '2026-09-10', 'norte'),
        route('south', '2026-09-07', 'sur'),
        route('north', '2026-09-07', 'norte'),
      ],
      [template('norte', 'Ruta Norte'), template('sur', 'Ruta Sur')],
    )

    expect(groups.map((group) => group.date)).toEqual(['2026-09-07', '2026-09-10'])
    expect(groups[0].routes.map((item) => item.route.id)).toEqual(['north', 'south'])
  })
})
