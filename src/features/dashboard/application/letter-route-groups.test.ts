import { describe, expect, it } from 'vitest'

import type { Letter } from '@/shared/types'

import { groupLettersByRoute } from './letter-route-groups'

const letter = (id: string, route: string, serviceDate: string, routeTemplateColor?: string) =>
  ({ id, route, serviceDate, routeTemplateColor }) as Letter

describe('groupLettersByRoute', () => {
  it('groups letters by route and service date, newest routes first', () => {
    const groups = groupLettersByRoute([
      letter('south', 'Ruta Sur', '2026-10-06'),
      letter('north-1', 'Ruta Norte', '2026-10-07'),
      letter('north-2', 'Ruta Norte', '2026-10-07'),
      letter('east', 'Ruta Este', '2026-10-07'),
    ])

    expect(
      groups.map((group) => [
        group.routeName,
        group.serviceDate,
        group.letters.map(({ id }) => id),
      ]),
    ).toEqual([
      ['Ruta Este', '2026-10-07', ['east']],
      ['Ruta Norte', '2026-10-07', ['north-1', 'north-2']],
      ['Ruta Sur', '2026-10-06', ['south']],
    ])
  })

  it('groups letters without an assigned route under Sin ruta', () => {
    const groups = groupLettersByRoute([letter('unassigned', '', '2026-10-07')])

    expect(groups[0].routeName).toBe('Sin ruta')
    expect(groups[0].letters.map(({ id }) => id)).toEqual(['unassigned'])
  })

  it('retains the configured template color on each route group', () => {
    const groups = groupLettersByRoute([
      letter('north', 'Ruta Norte', '2026-10-07', '#2a4227'),
      letter('south', 'Ruta Sur', '2026-10-07', '#c7202a'),
    ])

    expect(groups.map(({ routeName, templateColor }) => [routeName, templateColor])).toEqual([
      ['Ruta Norte', '#2a4227'],
      ['Ruta Sur', '#c7202a'],
    ])
  })
})
