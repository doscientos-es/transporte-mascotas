import { describe, expect, it } from 'vitest'

import type { DailyRoute, DailyRouteStop } from '@/shared/types'

import { DRIVER_SHEET_HEADER, driverSheetRows } from './driver-sheet'

describe('driver sheet rows', () => {
  it('exports the assigned van box number for pickup and delivery', () => {
    const route: DailyRoute = {
      id: 'route-1',
      templateId: 'template-1',
      date: '2026-10-07',
      status: 'activa',
      actions: ['recogida', 'entrega'].map((type, index) => ({
        id: `action-${index}`,
        letterId: 'letter-1',
        animalId: 'animal-1',
        type: type as 'recogida' | 'entrega',
        stop: 'Madrid',
        stopId: 'stop-1',
        customer: 'Ana Cliente',
        phone: '600000000',
        status: 'pendiente',
        box: 17,
      })),
    }
    const stops: DailyRouteStop[] = [
      {
        id: 'stop-1',
        locality: 'Madrid',
        place: '',
        mapUrl: '',
        minutes: 0,
        kind: 'parada',
        dwellMinutes: 15,
      },
    ]

    const rows = driverSheetRows(route, stops, [], () => '08:00')

    expect(DRIVER_SHEET_HEADER[3]).toBe('BOX')
    expect(rows.map((row) => row[3])).toEqual([17, 17])
  })
})
