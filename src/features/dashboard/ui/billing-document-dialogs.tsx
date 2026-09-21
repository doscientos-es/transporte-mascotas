import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@doscientos/ui'
import { CheckCircle2, Download } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { ClientInvoice, ManualPaymentMethod } from '@/shared/types'

import { prepareInvoiceDocument } from '../application/invoice-preview'
import { paymentRequestLetterName } from '../application/payment-request-letter-name'
import { createPaymentRequestDocument } from '../application/payment-request-pdf'
import { downloadBlob } from './billing-document-export'

export function InvoicePreviewDialog({
  invoice,
  onClose,
}: {
  invoice: NonNullable<ClientInvoice['issuedInvoice']>
  onClose: () => void
}) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    prepareInvoiceDocument(invoice.invoiceDraftId)
      .then((document) => {
        if (active) setPreviewUrl(document?.url ?? '')
      })
      .catch(() => {
        if (active) setError('No se ha podido preparar la vista previa de la factura.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [invoice.invoiceDraftId])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dialog-card invoice-preview-dialog">
        <DialogHeader className="gap-0">
          <DialogTitle>Factura {invoice.number}</DialogTitle>
          <DialogDescription>
            Documento creado desde la instantánea fiscal emitida.
          </DialogDescription>
        </DialogHeader>
        {loading && <p className="page-loading">Preparando factura…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {previewUrl && (
          <iframe
            className="invoice-preview"
            src={previewUrl}
            title={`Vista previa de la factura ${invoice.number}`}
          />
        )}
        {previewUrl && (
          <Button
            className="dialog-submit"
            onClick={() => window.open(`${previewUrl}&download=1`, '_blank', 'noopener,noreferrer')}
          >
            <Download /> Descargar factura
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function PaymentRequestPreviewDialog({
  invoice,
  clientName,
  onClose,
}: {
  invoice: ClientInvoice
  clientName: string
  onClose: () => void
}) {
  const [document, setDocument] = useState<{ blob: Blob; fileName: string; url: string } | null>(
    null,
  )
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let url = ''
    paymentRequestLetterName(invoice.letterId)
      .then((letterName) =>
        createPaymentRequestDocument({
          letterId: invoice.letterId,
          letterName,
          clientName,
          concept: invoice.concept,
          total: invoice.total,
          createdAt: invoice.createdAt,
        }),
      )
      .then((paymentRequest) => {
        if (!active) return
        url = URL.createObjectURL(paymentRequest.blob)
        setDocument({ ...paymentRequest, url })
      })
      .catch(() => {
        if (active) setError('No se ha podido preparar la vista previa de la solicitud.')
      })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [clientName, invoice.concept, invoice.createdAt, invoice.letterId, invoice.total])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dialog-card invoice-preview-dialog">
        <DialogHeader className="gap-0">
          <DialogTitle>Solicitud de pago {invoice.letterId}</DialogTitle>
          <DialogDescription>
            Documento informativo pendiente de cobro. No es una factura.
          </DialogDescription>
        </DialogHeader>
        {!document && !error && <p className="page-loading">Preparando solicitud…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {document && (
          <iframe
            className="invoice-preview"
            src={document.url}
            title={`Vista previa de la solicitud de pago ${invoice.letterId}`}
          />
        )}
        {document && (
          <Button
            className="dialog-submit"
            onClick={() => downloadBlob(document.blob, document.fileName)}
          >
            <Download /> Descargar solicitud
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ManualPaymentDialog({
  invoice,
  onClose,
  onConfirm,
  onConfirmed,
}: {
  invoice: ClientInvoice
  onClose: () => void
  onConfirm: (invoice: ClientInvoice, method: ManualPaymentMethod) => Promise<void>
  onConfirmed?: () => void
}) {
  const [method, setMethod] = useState<ManualPaymentMethod>('Transferencia')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    setSaving(true)
    setError('')
    try {
      await onConfirm(invoice, method)
      onClose()
      onConfirmed?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido registrar el cobro.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dialog-card">
        <DialogHeader className="gap-0">
          <DialogTitle>Registrar cobro manual</DialogTitle>
          <DialogDescription>
            Se emitirá y numerará la factura {invoice.letterId}. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <label className="date-field">
          Método de cobro
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as ManualPaymentMethod)}
          >
            <option>Transferencia</option>
            <option>Bizum</option>
            <option>Tarjeta</option>
          </select>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button className="dialog-submit" disabled={saving} onClick={() => void confirm()}>
          <CheckCircle2 /> {saving ? 'Emitiendo…' : 'Confirmar cobro y emitir'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
