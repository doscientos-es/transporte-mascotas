import { describe, expect, it } from 'vitest'

import { transportRequestRpcArgs, type CreateTransportRequestInput } from './transport-requests'

describe('transportRequestRpcArgs', () => {
  it('keeps billing data and maps animal measurements for both request flows', () => {
    const input = {
      contactName: 'Ana García',
      contactPhone: '600000000',
      contactEmail: 'ana@example.com',
      senderNif: '12345678Z',
      recipientName: 'Luis Pérez',
      recipientNif: '87654321X',
      recipientPhone: '611111111',
      recipientEmail: '',
      billingPayer: 'remitente',
      billingClient: {
        fullName: 'Ana García',
        nif: '12345678Z',
        email: 'ana@example.com',
        phone: '600000000',
        address: 'Calle Mayor 1',
        city: 'Madrid',
        postalCode: '28001',
      },
      origin: 'Madrid',
      destination: 'Valencia',
      desiredDate: '2026-10-01',
      dailyRouteId: 'route-id',
      notes: 'Llamar antes de llegar',
      animals: [
        {
          ordinal: 1,
          name: 'Nala',
          species: 'Canina',
          breed: 'Mestiza',
          weightKg: 12,
          lengthCm: 55,
          heightCm: 40,
          widthCm: 30,
          requestedBoxCategory: 'mediano',
        },
      ],
    } satisfies CreateTransportRequestInput

    expect(transportRequestRpcArgs(input)).toEqual({
      p_contact_name: 'Ana García',
      p_contact_phone: '600000000',
      p_contact_email: 'ana@example.com',
      p_sender_nif: '12345678Z',
      p_recipient_name: 'Luis Pérez',
      p_recipient_nif: '87654321X',
      p_recipient_phone: '611111111',
      p_recipient_email: '',
      p_billing_payer: 'remitente',
      p_billing_client: input.billingClient,
      p_daily_route_id: 'route-id',
      p_origin: 'Madrid',
      p_destination: 'Valencia',
      p_desired_date: '2026-10-01',
      p_notes: 'Llamar antes de llegar',
      p_animals: [
        {
          ordinal: 1,
          name: 'Nala',
          species: 'Canina',
          breed: 'Mestiza',
          weight_kg: 12,
          length_cm: 55,
          height_cm: 40,
          width_cm: 30,
          requested_box_category: 'mediano',
          client_pet_id: null,
        },
      ],
    })
  })
})
