import { describe, expect, it, vi } from 'vitest'

import { createPaymentRequestDocument } from './payment-request-pdf'

describe('createPaymentRequestDocument', () => {
  it('uses the generated brand icon in a downloadable payment request PDF', async () => {
    const icon = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/G0sAAAAASUVORK5CYII=',
      ),
      (character) => character.charCodeAt(0),
    )
    const fetchMock = vi.fn(
      async () => new Response(icon, { headers: { 'content-type': 'image/png' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    try {
      const document = await createPaymentRequestDocument({
        letterId: 'CARTA DE PORTE N° 2026-443',
        letterName: 'Ruta Madrid - Barcelona.pdf',
        clientName: 'Marcos Leal Ortega',
        concept: 'Servicio de transporte de mascota',
        total: 200,
        createdAt: '2026-08-31T12:00:00.000Z',
      })

      const header = new TextDecoder().decode((await document.blob.arrayBuffer()).slice(0, 5))

      expect(fetchMock).toHaveBeenCalledWith('/icon-512.png')
      expect(header).toBe('%PDF-')
      expect(document.fileName).toBe('solicitud-pago-Ruta-Madrid-Barcelona.pdf')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
