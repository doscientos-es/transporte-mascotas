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
  }, 30_000)

  it('reads a PDF with the compatibility viewer when native Iterator is unavailable', async () => {
    vi.stubGlobal('Iterator', undefined)

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const { jsPDF } = await import('jspdf')
    const document = new jsPDF()
    document.text('Factura de prueba', 20, 20)
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(document.output('arraybuffer')),
    })

    try {
      const pdf = await loadingTask.promise
      expect(pdf.numPages).toBe(1)
      expect(await pdf.getPage(1)).toMatchObject({ pageNumber: 1 })
    } finally {
      await loadingTask.destroy()
    }
  })
})
