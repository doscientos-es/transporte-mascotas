import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@doscientos/ui'
import { CheckCircle2, Download, ExternalLink } from 'lucide-react'
import * as pdfjs from 'pdfjs-dist'
import { useEffect, useRef, useState } from 'react'

import type { ClientInvoice, ManualPaymentMethod } from '@/shared/types'

import { prepareInvoiceDocument } from '../application/invoice-preview'
import { paymentRequestLetterName } from '../application/payment-request-letter-name'
import { createPaymentRequestDocument } from '../application/payment-request-pdf'
import { downloadBlob } from './billing-document-export'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export function InvoicePreviewDialog({
  invoice,
  onClose,
}: {
  invoice: NonNullable<ClientInvoice['issuedInvoice']>
  onClose: () => void
}) {
  const [document, setDocument] = useState<{ blob: Blob; fileName: string } | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    prepareInvoiceDocument(invoice.invoiceDraftId)
      .then(async (preparedDocument) => {
        if (!preparedDocument) return
        if (active) setSourceUrl(preparedDocument.url)
        const response = await fetch(preparedDocument.url)
        if (!response.ok) throw new Error('No se ha podido descargar la factura.')
        if (active) {
          setDocument({ blob: await response.blob(), fileName: preparedDocument.fileName })
        }
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
        <div className="invoice-preview-dialog-topbar">
          <DialogHeader className="gap-0">
            <DialogTitle>Factura {invoice.number}</DialogTitle>
            <DialogDescription>
              Documento creado desde la instantánea fiscal emitida.
            </DialogDescription>
          </DialogHeader>
          {document && (
            <div className="invoice-preview-top-actions">
              <Button
                variant="outline"
                onClick={() => downloadBlob(document.blob, document.fileName)}
              >
                <Download /> Descargar
              </Button>
              <Button variant="outline" onClick={() => openBlob(document.blob)}>
                <ExternalLink /> Abrir
              </Button>
            </div>
          )}
        </div>
        {loading && <p className="page-loading">Preparando factura…</p>}
        {error && (
          <div className="form-error" role="alert">
            <p>{error}</p>
            {sourceUrl && (
              <Button
                variant="outline"
                onClick={() => window.open(sourceUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink /> Abrir factura
              </Button>
            )}
          </div>
        )}
        {document && (
          <PaymentRequestPdfPreview
            blob={document.blob}
            fallback={<p className="form-error">Usa «Abrir» para ver la factura completa.</p>}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
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
  const [document, setDocument] = useState<{ blob: Blob; fileName: string } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
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
        setDocument(paymentRequest)
      })
      .catch(() => {
        if (active) setError('No se ha podido preparar la vista previa de la solicitud.')
      })
    return () => {
      active = false
    }
  }, [clientName, invoice.concept, invoice.createdAt, invoice.letterId, invoice.total])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dialog-card invoice-preview-dialog">
        <div className="invoice-preview-dialog-topbar">
          <DialogHeader className="gap-0">
            <DialogTitle>Solicitud de pago {invoice.letterId}</DialogTitle>
            <DialogDescription>
              Documento informativo pendiente de cobro. No es una factura.
            </DialogDescription>
          </DialogHeader>
          {document && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadBlob(document.blob, document.fileName)}
            >
              <Download size={14} /> Descargar
            </Button>
          )}
        </div>
        {!document && !error && <p className="page-loading">Preparando solicitud…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {document && (
          <PaymentRequestPdfPreview
            blob={document.blob}
            fallback={<PaymentRequestDocumentPreview invoice={invoice} clientName={clientName} />}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PaymentRequestPdfPreview({ blob, fallback }: { blob: Blob; fallback: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let loadingTask: ReturnType<typeof pdfjs.getDocument> | undefined
    void blob
      .arrayBuffer()
      .then((data) => {
        if (!active) return null
        loadingTask = pdfjs.getDocument({ data })
        return loadingTask.promise
      })
      .then(async (pdf) => {
        if (!pdf) return
        const page = await pdf.getPage(1)
        if (!active || !canvasRef.current) return
        const viewport = page.getViewport({ scale: 1.35 })
        const canvas = canvasRef.current
        canvas.width = viewport.width
        canvas.height = viewport.height
        const canvasContext = canvas.getContext('2d')
        if (!canvasContext) throw new Error('No se ha podido preparar la vista previa.')
        await page.render({ canvas, canvasContext, viewport }).promise
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
      void loadingTask?.destroy()
    }
  }, [blob])

  if (failed) return fallback
  return (
    <canvas ref={canvasRef} className="invoice-preview-pdf" aria-label="Vista previa del PDF" />
  )
}

function PaymentRequestDocumentPreview({
  invoice,
  clientName,
}: {
  invoice: ClientInvoice
  clientName: string
}) {
  return (
    <article className="payment-request-preview" aria-label="Vista previa de la solicitud de pago">
      <header className="payment-request-preview-header">
        <div>
          <strong>KACHE ENVÍOS</strong>
          <span>Transporte de mascotas</span>
        </div>
        <b>DOCUMENTO NO FISCAL</b>
      </header>
      <div className="payment-request-preview-body">
        <p className="payment-request-preview-kicker">Solicitud de pago</p>
        <h3>Resumen del servicio y del importe solicitado</h3>
        <div className="payment-request-preview-meta">
          <div>
            <span>Cliente</span>
            <strong>{clientName}</strong>
          </div>
          <div>
            <span>Carta de porte</span>
            <strong>{invoice.letterId}</strong>
          </div>
        </div>
        <div className="payment-request-preview-concept">
          <span>Concepto</span>
          <strong>{invoice.concept}</strong>
        </div>
        <div className="payment-request-preview-total">
          <span>Importe solicitado</span>
          <strong>
            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
              invoice.total,
            )}
          </strong>
        </div>
        <p className="payment-request-preview-date">
          Solicitud creada el {new Date(invoice.createdAt).toLocaleDateString('es-ES')}
        </p>
        <p className="payment-request-preview-note">
          Este documento es informativo y no sustituye a una factura.
        </p>
      </div>
    </article>
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
