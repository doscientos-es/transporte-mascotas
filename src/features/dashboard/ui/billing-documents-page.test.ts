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
  it('offers free invoice creation only when explicitly enabled for administrators', async () => {
    const { InvoicesPage } = await import('./invoices-page')
    const render = (canCreateManualInvoice: boolean) =>
      renderToStaticMarkup(
        createElement(MemoryRouter, null, createElement(InvoicesPage, { canCreateManualInvoice })),
      )
    expect(render(true)).toContain('Nueva factura')
    expect(render(false)).not.toContain('Nueva factura')
  })

  it('shows an issued free invoice as paid without a carriage-letter link', async () => {
    const { BillingDocumentCard } = await import('./billing-document-card')
    const markup = renderToStaticMarkup(
      createElement(BillingDocumentCard, {
        invoice: {
          id: 'invoice',
          letterId: null,
          clientId: 'client',
          payer: 'manual',
          concept: 'Extra',
          total: 121,
          status: 'emitida',
          createdAt: '2026-01-10',
          clientName: 'Test',
        },
        mode: 'invoices',
        clientName: 'Test',
        downloading: false,
        onPreview: vi.fn(),
        onDownload: vi.fn(),
        onOpenLetter: vi.fn(),
      }),
    )
    expect(markup).toContain('Factura libre')
    expect(markup).toContain('Pagada')
    expect(markup).not.toContain('invoice-card-link invoice-reference')
  })

  it('shows invoice details and editing actions in the desktop table', async () => {
    const { BillingDocumentTable } = await import('./billing-document-table')
    const markup = renderToStaticMarkup(
      createElement(BillingDocumentTable, {
        invoices: [
          {
            id: 'draft',
            letterId: null,
            clientId: 'client',
            payer: 'manual',
            concept: 'Extra',
            total: 121,
            status: 'emitida',
            createdAt: '2026-01-10',
            clientName: 'Test',
            issuedInvoice: {
              id: 'issued',
              invoiceDraftId: 'draft',
              number: 'F-2026-000819',
              issuedAt: '2026-01-10',
              fiscalSnapshot: {},
            },
          },
        ],
        downloadingId: null,
        onPreview: vi.fn(),
        onDownload: vi.fn(),
        onEdit: vi.fn(),
      }),
    )
    expect(markup).toContain('<table')
    expect(markup).toContain('F-2026-000819')
    expect(markup).toContain('Factura libre')
    expect(markup).toContain('Pagada')
    for (const label of ['Ver factura', 'Descargar factura', 'Editar factura']) {
      expect(markup).toContain(`aria-label="${label}"`)
    }
    expect(markup.match(/data-size="icon-sm"/g)).toHaveLength(3)
    expect(markup).not.toContain('invoice-action-label')
    expect(markup).not.toContain('invoice-download-label')
  })

  it('keeps the download disabled while preparing it and retains labels on cards', async () => {
    const { BillingDocumentActions } = await import('./billing-document-card')
    const props = {
      mode: 'invoices' as const,
      downloading: true,
      onPreview: vi.fn(),
      onDownload: vi.fn(),
    }
    const compact = renderToStaticMarkup(
      createElement(BillingDocumentActions, { ...props, compact: true }),
    )
    expect(compact).toMatch(/<button[^>]*disabled[^>]*aria-label="Descargar factura"/)
    const card = renderToStaticMarkup(createElement(BillingDocumentActions, props))
    expect(card).toContain('invoice-action-label')
    expect(card).toContain('Preparando…')
  })

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
