import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { defaultTransportBoxCatalog } from '@/shared/application/transport-boxes'
import type { DailyRoute, RouteTemplate } from '@/shared/types'

import { LetterForm } from './operation-dialogs'

const stops = ['Madrid', 'Zaragoza', 'Madrid', 'Barcelona'].map((locality, index) => ({
  id: `stop-${index + 1}`,
  locality,
  place: '',
  mapUrl: '',
  minutes: 0,
  kind: 'parada' as const,
  dwellMinutes: 15,
}))

const route: DailyRoute = {
  id: 'route-1',
  templateId: 'template-1',
  date: '2099-10-01',
  status: 'activa',
  actions: [],
  stops,
}

const template: RouteTemplate = {
  id: 'template-1',
  name: 'Ruta repetida',
  color: '#b51e27',
  stops,
}

describe('LetterForm route stop options', () => {
  it('shows repeated stops as distinct origin and destination options', () => {
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [route],
        templates: [template],
        boxCatalog: defaultTransportBoxCatalog,
        onClose: vi.fn(),
        onCreate: vi.fn().mockResolvedValue(undefined),
        onAddStop: vi.fn().mockResolvedValue(stops[0]),
      }),
    )

    expect(markup).toContain('value="stop-1"')
    expect(markup).toContain('value="stop-3"')
    expect(markup).toContain('Madrid · parada 1')
    expect(markup).toContain('Madrid · parada 3')
  })
})