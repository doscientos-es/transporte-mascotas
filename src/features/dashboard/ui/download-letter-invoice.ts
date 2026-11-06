import { loadInvoiceDocumentBlob, prepareInvoiceDocument } from '../application/invoice-preview'
import { downloadBlob } from './billing-document-export'

export async function downloadLetterInvoice(invoiceDraftId: string) {
  const document = await prepareInvoiceDocument(invoiceDraftId)
  if (!document) throw new Error('No se ha podido preparar la descarga de la factura.')
  const blob = await loadInvoiceDocumentBlob(document.url)
  downloadBlob(blob, document.fileName || 'factura.pdf')
}
