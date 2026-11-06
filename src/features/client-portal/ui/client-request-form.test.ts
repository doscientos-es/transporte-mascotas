import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { defaultTransportBoxCatalog } from '@/shared/application/transport-boxes'
import type { UpcomingRoute } from '@/shared/types'

import { payerIdentity } from '../application/request-payer'
import { ClientRequestForm, validateRequestContactDetails, type RequestFormValues } from './client-request-form'

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
        contactName: 'Ana García',
        contactPhone: '600000000',
        contactEmail: 'ana@example.test',
        onSubmit: vi.fn().mockResolvedValue(undefined),
        onCancel: vi.fn(),
        boxCatalog: defaultTransportBoxCatalog,
        initialRouteId: route.id,
      }),
    )

    expect(markup).toContain('martes, 6 de octubre de 2026')
    expect(markup).toMatch(
      /<output[^>]*id="request-desired-date"[^>]*aria-labelledby="request-desired-date-label"/,
    )
    expect(markup).not.toMatch(/<input[^>]*id="request-desired-date"/)
  })
})

describe('ClientRequestForm contact details', () => {
  it('starts on the route step, before the contact details, even with a preselected route', () => {
    for (const initialRouteId of [undefined, route.id]) {
      const markup = renderToStaticMarkup(
        createElement(ClientRequestForm, {
          routes: [route],
          contactName: 'Ana García',
          contactPhone: '600000000',
          contactEmail: 'ana@example.test',
          onSubmit: vi.fn().mockResolvedValue(undefined),
          onCancel: vi.fn(),
          boxCatalog: defaultTransportBoxCatalog,
          initialRouteId,
        }),
      )

      expect(markup.indexOf('Trayecto')).toBeLessThan(markup.indexOf('Contacto'))
      expect(markup).toContain('class="client-request-form-shell"')
      expect(markup).not.toContain('id="request-sender-address"')
    }
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

describe('ClientRequestForm email requirements', () => {
  const values = {
    contactName: 'Ana', senderNif: '123', contactPhone: '600000000',
    contactEmail: 'ana@example.test', senderAddress: 'Calle', senderPostalCode: '28001',
    senderCity: 'Madrid', senderProvince: 'Madrid', recipientName: 'Luis', recipientNif: '456',
    recipientPhone: '611111111', recipientEmail: 'luis@example.test', recipientAddress: 'Calle',
    recipientPostalCode: '46001', recipientCity: 'Valencia', recipientProvince: 'Valencia',
    billingPayer: 'manual', billingClient: {
      fullName: 'Empresa', nif: '123', address: 'Calle', postalCode: '28001', city: 'Madrid',
      email: 'empresa@example.test', phone: '600000000',
    },
  } as RequestFormValues

  it('accepts valid sender, recipient and payer emails', () => {
    expect(validateRequestContactDetails(values)).toEqual({ message: '' })
  })

  it.each(['', '   ', 'incorrecto'])('requires a valid sender email: %j', (email) => {
    expect(validateRequestContactDetails({ ...values, contactEmail: email }).fieldId).toBe('request-contact-email')
  })

  it.each(['', '   ', 'incorrecto'])('requires a valid recipient email: %j', (email) => {
    expect(validateRequestContactDetails({ ...values, recipientEmail: email }).fieldId).toBe('request-recipient-email')
  })

  it.each(['', '   ', 'incorrecto'])('requires a valid separate payer email: %j', (email) => {
    expect(validateRequestContactDetails({ ...values, billingClient: { ...values.billingClient, email } }).fieldId).toBe('request-billing-email')
  })

  it('does not require a separate payer email when the payer is the sender or recipient', () => {
    for (const billingPayer of ['remitente', 'destinatario'] as const) {
      expect(validateRequestContactDetails({ ...values, billingPayer, billingClient: { ...values.billingClient, email: '' } })).toEqual({ message: '' })
    }
  })
})
