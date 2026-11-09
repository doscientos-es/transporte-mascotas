import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { defaultTransportBoxCatalog } from '@/shared/application/transport-boxes'
import type { DailyRoute } from '@/shared/types'

vi.mock('@/shared/ui/filter-controls', () => ({
  SelectField: ({ options, value }: { options: { id: string; label: string }[]; value: string }) =>
    createElement(
      'select',
      { defaultValue: value },
      options.map((option) =>
        createElement('option', { key: option.id, value: option.id }, option.label),
      ),
    ),
}))

import { VanPage } from './van-page'

describe('VanPage route selector', () => {
  it('lists the latest service dates first, including the year without changing the selected route', () => {
    const routes: DailyRoute[] = ['2025-01-03', '2027-01-03', '2026-01-03'].map((date) => ({
      id: date,
      date,
      templateId: 'template',
      status: 'activa',
      actions: [],
    }))
    const markup = renderToStaticMarkup(
      createElement(VanPage, {
        route: routes[0],
        routes,
        templates: [{ id: 'template', name: 'Madrid', color: '', stops: [] }],
        letters: [],
        assignments: [],
        boxCatalog: defaultTransportBoxCatalog,
        canManage: true,
        onSelectRoute: vi.fn(),
        onReassignBox: vi.fn(),
      }),
    )

    expect(markup.indexOf('value="2027-01-03"')).toBeLessThan(markup.indexOf('value="2026-01-03"'))
    expect(markup.indexOf('value="2026-01-03"')).toBeLessThan(markup.indexOf('value="2025-01-03"'))
    expect(markup).toContain('Madrid · 3 ene 2027')
    expect(markup).toContain('value="2025-01-03" selected=""')
    expect(routes.map((item) => item.id)).toEqual(['2025-01-03', '2027-01-03', '2026-01-03'])
  })

  it('renders searchable assignment rows with an accessible box detail action', () => {
    const route: DailyRoute = {
      id: 'route-1',
      date: '2026-11-09',
      templateId: 'template',
      status: 'activa',
      actions: [
        {
          id: 'pickup-1',
          letterId: 'letter-1',
          animalId: 'animal-1',
          type: 'recogida',
          stop: 'Alcalá',
          customer: 'Ana Pérez',
          phone: '',
          status: 'pendiente',
          box: 5,
        },
      ],
    }
    const markup = renderToStaticMarkup(
      createElement(VanPage, {
        route,
        routes: [route],
        templates: [{ id: 'template', name: 'Madrid', color: '', stops: [] }],
        letters: [],
        assignments: [{ box: 5, label: 'letter-1', animalCount: 1 }],
        boxCatalog: defaultTransportBoxCatalog,
        canManage: true,
        onSelectRoute: vi.fn(),
        onReassignBox: vi.fn(),
      }),
    )

    expect(markup).toContain('<table class="assignments-table">')
    expect(markup).toContain('aria-label="Buscar asignaciones"')
    expect(markup).toContain('aria-label="Abrir detalle del box 5"')
    expect(markup).toContain('Alcalá')
  })
})
