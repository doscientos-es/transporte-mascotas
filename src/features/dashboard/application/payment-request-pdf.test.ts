import { describe, expect, it } from 'vitest'

import { createPaymentRequestDocument } from './payment-request-pdf'

describe('createPaymentRequestDocument', () => {
  it('creates a downloadable PDF clearly identified as a payment request', async () => {
    const document = await createPaymentRequestDocument({
      letterId: 'CARTA DE PORTE N° 2026-443',
      letterName: 'Ruta Madrid - Barcelona.pdf',
      clientName: 'Marcos Leal Ortega',
      concept: 'Servicio de transporte de mascota',
      total: 200,
      createdAt: '2026-08-31T12:00:00.000Z',
    })

    const header = new TextDecoder().decode((await document.blob.arrayBuffer()).slice(0, 5))

    expect(header).toBe('%PDF-')
    expect(document.fileName).toBe('solicitud-pago-Ruta-Madrid-Barcelona.pdf')
  })
})
