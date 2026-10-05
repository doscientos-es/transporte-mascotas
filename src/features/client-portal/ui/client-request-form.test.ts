import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { defaultTransportBoxCatalog } from '@/shared/application/transport-boxes'
import type { UpcomingRoute } from '@/shared/types'

import { ClientRequestForm } from './client-request-form'

const route: UpcomingRoute = {
  id: 'route-1',
  serviceDate: '2026-10-06',
  routeDirection: 'normal',
  templateName: 'Norte',
  templateColor: '#b51e27',
  localities: ['Burgos', 'Cáceres'],
  stops: [],
}

describe('ClientRequestForm departure date', () => {
  it('shows the selected route date as information, not as an editable input', () => {
    const markup = renderToStaticMarkup(
      createElement(ClientRequestForm, {
        routes: [route],
        savedPets: [],
        contactName: 'Ana García',
        contactPhone: '600000000',
        contactEmail: 'ana@example.test',
        onSubmit: vi.fn().mockResolvedValue(undefined),
        onCancel: vi.fn(),
        onSavePets: vi.fn().mockResolvedValue(undefined),
        boxCatalog: defaultTransportBoxCatalog,
        initialRouteId: route.id,
      }),
    )

    expect(markup).toContain('martes, 6 de octubre de 2026')
    expect(markup).toContain('Fecha fijada por la ruta seleccionada')
    expect(markup).toContain('<output')
    expect(markup).not.toContain('id="request-desired-date" type="date"')
  })
})
