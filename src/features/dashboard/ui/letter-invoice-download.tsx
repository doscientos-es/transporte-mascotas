import { Button } from '@doscientos/ui'
import { FileDown } from 'lucide-react'
import { useState } from 'react'

import { loadInvoiceDocumentBlob, prepareInvoiceDocument } from '../application/invoice-preview'
import { downloadBlob } from './billing-document-export'

export async function downloadLetterInvoice(invoiceDraftId: string) {
  const document = await prepareInvoiceDocument(invoiceDraftId)
  if (!document) throw new Error('No se ha podido preparar la descarga de la factura.')
  const blob = await loadInvoiceDocumentBlob(document.url)
  downloadBlob(blob, document.fileName || 'factura.pdf')
}

export function LetterInvoiceDownload({ invoiceDraftId }: { invoiceDraftId?: string | undefined }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!invoiceDraftId) return null

  async function download() {
    if (!invoiceDraftId) return
    setLoading(true)
    setError('')
    try {
      await downloadLetterInvoice(invoiceDraftId)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido descargar la factura.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" disabled={loading} onClick={() => void download()}>
        <FileDown size={15} /> {loading ? 'Descargando factura…' : 'Descargar factura'}
      </Button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  )
}