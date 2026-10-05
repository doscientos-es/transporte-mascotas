import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { TransportRequest } from '@/shared/types'

import { ClientTransportCard } from './client-transport-card'

const request: TransportRequest = {
  id: 'request-1',
  requesterId: 'client-1',
  contactName: 'Ana García',
  contactPhone: '600000000',
  contactEmail: 'ana@example.test',
  senderNif: '12345678Z',
  senderAddress: 'Calle Mayor 1',
  senderPostalCode: '28001',
  senderCity: 'Madrid',
  senderProvince: 'Madrid',
  recipientName: 'Ana García',
  recipientNif: '12345678Z',
  recipientPhone: '600000000',
  recipientEmail: '',
  recipientAddress: 'Calle Mayor 1',
  recipientPostalCode: '28001',
  recipientCity: 'Madrid',
  recipientProvince: 'Madrid',
  billingPayer: 'remitente',
  billingClient: {
    fullName: 'Ana García',
    nif: '12345678Z',
    email: 'ana@example.test',
    phone: '600000000',
    address: 'Calle Mayor 1',
    city: 'Madrid',
    postalCode: '28001',
  },
  origin: 'Cádiz-Jerez de la Frontera',
  destination: 'Córdoba',
  desiredDate: '2026-09-23',
  dailyRouteId: 'route-1',
  originLatitude: 36.7,
  originLongitude: -6.1,
  destinationLatitude: 37.9,
  destinationLongitude: -4.8,
  notes: '',
  status: 'confirmada',
  amountCents: 12000,
  paymentReference: 'payment-1',
  paidAt: '2026-09-20T12:00:00Z',
  adminNote: '',
  createdAt: '2026-09-20T10:00:00Z',
  animals: [
    {
      id: 'animal-1',
      name: 'Nala',
      ordinal: 1,
      species: 'Canina',
      breed: 'Mestiza',
      birthDate: '2024-05-10',
      weightKg: 12,
      lengthCm: 55,
      heightCm: 40,
      widthCm: 30,
      assignedBoxCategory: 'mediano',
    },
  ],
}

const renderCard = (transportRequest: TransportRequest) =>
  renderToStaticMarkup(
    createElement(ClientTransportCard, {
      request: transportRequest,
      formatCurrency: () => '120,00 €',
      payingRequestId: null,
      downloadingInvoiceId: null,
      downloadingLetterId: null,
      onContinuePayment: vi.fn(),
      onDownloadInvoice: vi.fn(),
      onDownloadCarriageLetter: vi.fn(),
    }),
  )

describe('ClientTransportCard', () => {
  it('shows trip, pet, payment status, locations and document actions', () => {
    const markup = renderCard(request)

    expect(markup).toContain('Cádiz-Jerez de la Frontera')
    expect(markup).toContain('Córdoba')
    expect(markup).toContain('Nala')
    expect(markup).toContain('120,00 €')
    expect(markup).toContain('data-status="confirmada"')
    expect(markup).toContain('Pago registrado')
    expect(markup).toContain('Recogida: Cádiz-Jerez de la Frontera')
    expect(markup).toContain('Entrega: Córdoba')
    expect(markup).toContain('Descargar factura')
    expect(markup).toContain('Descargar carta de porte')
  })

  it('offers payment for an unpaid request and keeps documents unavailable', () => {
    const markup = renderCard({ ...request, status: 'pago_pendiente', paidAt: undefined })

    expect(markup).toContain('Continuar pago')
    expect(markup).not.toContain('Descargar factura')
    expect(markup).not.toContain('Descargar carta de porte')
  })
})
