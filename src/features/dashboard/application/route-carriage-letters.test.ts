import { describe, expect, it } from 'vitest'

import type { DailyRoute, Letter, ServiceAction } from '@/shared/types'

import { routeCarriageLetters } from './route-carriage-letters'

const action = (letterId: string, type: ServiceAction['type'], box?: number): ServiceAction => ({
  id: `${letterId}-${type}`,
  letterId,
  animalId: 'animal',
  type,
  stop: 'Madrid',
  customer: 'Cliente',
  phone: '',
  status: 'pendiente',
  box,
})
const route = (actions: ServiceAction[]): DailyRoute => ({
  id: 'route-1',
  templateId: 'template-1',
  date: '2026-12-01',
  status: 'activa',
  actions,
})
const letter = (id: string, status: Letter['status'] = 'pendiente') =>
  ({ id, status, animals: [] }) as unknown as Letter

describe('routeCarriageLetters', () => {
  it('selects the route actions once per letter, with the pickup box, excluding cancelled and other routes', () => {
    const documents = routeCarriageLetters(
      route([
        action('first', 'recogida', 17),
        action('first', 'entrega', 17),
        action('second', 'recogida', 23),
        action('cancelled', 'recogida', 5),
      ]),
      [letter('other'), letter('first'), letter('second'), letter('cancelled', 'cancelada')],
    )
    expect(documents.map(({ id, transport_box_number }) => [id, transport_box_number])).toEqual([
      ['first', 17],
      ['second', 23],
    ])
  })

  it('does not silently export an incomplete route if a letter is missing', () => {
    expect(() => routeCarriageLetters(route([action('missing', 'recogida')]), [])).toThrow(
      'Faltan cartas de la ruta',
    )
  })
})
