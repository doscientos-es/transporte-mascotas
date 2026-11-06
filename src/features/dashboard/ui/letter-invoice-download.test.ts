import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prepare, load, download } = vi.hoisted(() => ({
  prepare: vi.fn(),
  load: vi.fn(),
  download: vi.fn(),
}))
vi.mock('../application/invoice-preview', () => ({
  prepareInvoiceDocument: prepare,
  loadInvoiceDocumentBlob: load,
}))
vi.mock('./billing-document-export', () => ({ downloadBlob: download }))

import { downloadLetterInvoice, LetterInvoiceDownload } from './letter-invoice-download'

describe('letter invoice download', () => {
  beforeEach(() => vi.resetAllMocks())

  it('only offers the action for a linked issued invoice', () => {
    expect(renderToStaticMarkup(createElement(LetterInvoiceDownload, {}))).toBe('')
    expect(renderToStaticMarkup(createElement(LetterInvoiceDownload, { invoiceDraftId: 'draft' })))
      .toContain('Descargar factura')
  })

  it('downloads the stored invoice PDF using its draft ID and filename', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' })
    prepare.mockResolvedValue({ url: 'https://example.test/invoice', fileName: 'factura.pdf' })
    load.mockResolvedValue(blob)

    await downloadLetterInvoice('draft')

    expect(prepare).toHaveBeenCalledWith('draft')
    expect(load).toHaveBeenCalledWith('https://example.test/invoice')
    expect(download).toHaveBeenCalledWith(blob, 'factura.pdf')
  })

  it('does not download when the invoice cannot be prepared', async () => {
    prepare.mockResolvedValue(null)
    await expect(downloadLetterInvoice('draft')).rejects.toThrow('No se ha podido preparar')
    expect(load).not.toHaveBeenCalled()
    expect(download).not.toHaveBeenCalled()
  })
})