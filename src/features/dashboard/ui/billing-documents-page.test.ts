import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infrastructure/supabase', () => ({
  supabase: null,
  requireSupabase: vi.fn(),
}))

afterEach(() => vi.unstubAllGlobals())

describe('billing browser compatibility', () => {
  it('opens invoices and payment requests without the Iterator API required by the PDF viewer', async () => {
    vi.stubGlobal('Iterator', undefined)

    const { InvoicesPage } = await import('./invoices-page')
    const { PaymentRequestsPage } = await import('./payment-requests-page')

    for (const [Page, heading] of [
      [InvoicesPage, 'Facturas'],
      [PaymentRequestsPage, 'Pagos pendientes'],
    ] as const) {
      const markup = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Page)))

      expect(markup).toContain(`<h2>${heading}</h2>`)
      expect(markup).toContain('Buscar documentos')
      expect(markup).not.toContain('Vamos a solucionarlo')
    }
  })
})
