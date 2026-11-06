import { Button } from '@doscientos/ui'
import { FileDown } from 'lucide-react'
import { useState } from 'react'

import { downloadLetterInvoice } from './download-letter-invoice'

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
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
