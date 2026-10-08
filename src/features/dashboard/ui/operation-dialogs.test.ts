import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { defaultTransportBoxCatalog } from '@/shared/application/transport-boxes'
import type { DailyRoute, Letter, RouteTemplate } from '@/shared/types'

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
  actions: [
    {
      id: 'action-1',
      letterId: 'letter-1',
      animalId: 'animal-1',
      type: 'recogida',
      stop: 'Madrid',
      customer: 'Ana',
      phone: '600000000',
      status: 'pendiente',
      stopId: 'stop-1',
    },
  ],
  stops,
}

const template: RouteTemplate = {
  id: 'template-1',
  name: 'Ruta repetida',
  color: '#b51e27',
  stops,
}

const letter: Letter = {
  id: 'letter-1',
  sender: 'Ana',
  senderPhone: '600000000',
  senderEmail: 'ana@example.test',
  senderNif: '12345678Z',
  senderAddress: 'Calle Mayor 1',
  senderPostalCode: '28001',
  senderCity: 'Madrid',
  senderProvince: 'Madrid',
  recipient: 'Luis',
  recipientPhone: '611111111',
  recipientEmail: 'luis@example.test',
  recipientNif: '87654321X',
  recipientAddress: 'Avenida 2',
  recipientPostalCode: '46001',
  recipientCity: 'Barcelona',
  recipientProvince: 'Barcelona',
  origin: 'Madrid',
  destination: 'Barcelona',
  originPoint: '',
  destinationPoint: '',
  accompanyingDocuments: ['microchip'],
  billingPayer: 'remitente',
  billingClient: {
    fullName: 'Ana',
    nif: '12345678Z',
    email: 'ana@example.test',
    phone: '600000000',
    address: 'Calle Mayor 1',
    city: 'Madrid',
    postalCode: '28001',
  },
  route: 'Ruta repetida',
  serviceDate: '2099-10-01',
  status: 'pendiente',
  animals: [],
  importedAt: '',
}

describe('LetterForm route stop options', () => {
  it('shows repeated stops as distinct origin and destination options', () => {
    const markup = renderToStaticMarkup(
      createElement(LetterForm, {
        routes: [route],
        templates: [template],
        letter,
        routeId: route.id,
        fullPage: true,
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
