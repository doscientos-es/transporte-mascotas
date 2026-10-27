import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { TransportRequest, UpcomingRoute } from '@/shared/types'

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
  desiredDate: '2999-09-23',
  dailyRouteId: 'route-1',
  originLatitude: 36.7,
  originLongitude: -6.1,
  destinationLatitude: 37.9,
  destinationLongitude: -4.8,
  accompanyingDocuments: ['cartilla_sanitaria'],
  notes: '',
  status: 'confirmada',
  paymentAttemptStatus: 'confirmed',
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

const renderCard = (
  transportRequest: TransportRequest,
  route?: Pick<UpcomingRoute, 'serviceDate' | 'startTime' | 'endDate' | 'stops'>,
) =>
  renderToStaticMarkup(
    createElement(ClientTransportCard, {
      request: transportRequest,
      route,
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
    expect(markup).not.toContain('Franja aproximada:')
    expect(markup).toContain('Descargar factura')
    expect(markup).toContain('Descargar carta de porte')
  })

  it('shows the real pickup day and time at the origin stop, not the route start', () => {
    const markup = renderToStaticMarkup(
      createElement(ClientTransportCard, {
        request: { ...request, desiredDate: '2999-09-23' },
        route: {
          serviceDate: '2999-09-23',
          startTime: '23:00',
          stops: [
            { id: 's1', locality: 'Sevilla', minutes: 90, dwellMinutes: 0 },
            { id: 's2', locality: 'Cádiz-Jerez de la Frontera', minutes: 60 },
          ] as UpcomingRoute['stops'],
        },
        formatCurrency: () => '120,00 €',
        payingRequestId: null,
        downloadingInvoiceId: null,
        downloadingLetterId: null,
        onContinuePayment: vi.fn(),
        onDownloadInvoice: vi.fn(),
        onDownloadCarriageLetter: vi.fn(),
      }),
    )

    expect(markup).toContain('dateTime="2999-09-24T00:30"')
    expect(markup).toContain('00:30 h')
  })

  it('shows approximate pickup and delivery windows at their locations', () => {
    const markup = renderCard(request, {
      serviceDate: request.desiredDate,
      startTime: '11:00',
      stops: [
        { id: 'origin', locality: request.origin, minutes: 120, dwellMinutes: 0 },
        { id: 'destination', locality: request.destination, minutes: 0 },
      ] as UpcomingRoute['stops'],
    })

    expect(markup).toContain('Franja aproximada: mañana (06:00–12:00)')
    expect(markup).toContain('Franja aproximada: mediodía (12:00–15:00)')
  })

  it('shows a confirmed request as delivered once its route date has passed', () => {
    const markup = renderCard({ ...request, desiredDate: '2020-01-01' })

    expect(markup).toContain('data-status="entregada"')
  })

  it('offers payment for an unpaid request and keeps documents unavailable', () => {
    const markup = renderCard({
      ...request,
      status: 'pago_pendiente',
      paymentAttemptStatus: 'not_started',
      paidAt: undefined,
    })

    expect(markup).toContain('Continuar pago')
    expect(markup).not.toContain('Descargar factura')
    expect(markup).not.toContain('Descargar carta de porte')
  })

  it('does not offer another payment while a bank result is uncertain', () => {
    const markup = renderCard({
      ...request,
      status: 'pago_pendiente',
      paymentAttemptStatus: 'review_required',
      paidAt: undefined,
    })

    expect(markup).toContain('No vuelvas a pagar')
    expect(markup).not.toContain('Continuar pago')
  })
})
