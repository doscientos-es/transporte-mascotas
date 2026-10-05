import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { defaultTransportBoxCatalog } from '@/shared/application/transport-boxes'
import type { UpcomingRoute } from '@/shared/types'

import { payerIdentity } from '../application/request-payer'
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

describe('ClientRequestForm contact details', () => {
  it('collects complete addresses for both parties and reuses the selected payer details', () => {
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
      }),
    )

    for (const id of [
      'request-sender-address',
      'request-sender-postal-code',
      'request-sender-city',
      'request-sender-province',
      'request-recipient-address',
      'request-recipient-postal-code',
      'request-recipient-city',
      'request-recipient-province',
    ])
      expect(markup).toContain(`id="${id}"`)

    expect(markup).toContain('La factura utilizará los datos de quien')
    expect(markup).toContain('No hace falta volver a rellenar estos datos.')
    expect(markup).toContain('class="client-request-form-shell"')
    expect(markup).toContain('border-input bg-background min-h-11 rounded-md border')
    expect(markup).not.toContain('table-card client-request-card')
    expect(markup).not.toContain('id="request-billing-name"')
    expect(markup).not.toContain('id="request-billing-address"')
  })

  it('copies the selected sender or recipient identity and address into invoice data', () => {
    const parties = {
      contactName: 'Ana García',
      senderNif: '12345678Z',
      contactEmail: 'ana@example.test',
      contactPhone: '600000000',
      senderAddress: 'Calle Mayor 1',
      senderPostalCode: '28001',
      senderCity: 'Madrid',
      recipientName: 'Luis Pérez',
      recipientNif: '87654321X',
      recipientEmail: 'luis@example.test',
      recipientPhone: '611111111',
      recipientAddress: 'Avenida del Puerto 2',
      recipientPostalCode: '46001',
      recipientCity: 'Valencia',
    }

    expect(payerIdentity({ ...parties, billingPayer: 'remitente' })).toMatchObject({
      fullName: 'Ana García',
      nif: '12345678Z',
      address: 'Calle Mayor 1',
      postalCode: '28001',
      city: 'Madrid',
    })
    expect(payerIdentity({ ...parties, billingPayer: 'destinatario' })).toMatchObject({
      fullName: 'Luis Pérez',
      nif: '87654321X',
      address: 'Avenida del Puerto 2',
      postalCode: '46001',
      city: 'Valencia',
    })
    expect(payerIdentity({ ...parties, billingPayer: 'manual' })).toEqual({})
  })
})
