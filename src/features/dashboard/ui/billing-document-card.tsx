import { Button, Card, CardContent } from '@doscientos/ui'
import { CheckCircle2, Download, Eye, FileText, Pencil, ReceiptText } from 'lucide-react'

import type { ClientInvoice } from '@/shared/types'

import type { BillingDocumentMode } from './billing-document-types'

const currency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)

type DocumentActions = {
  mode: BillingDocumentMode
  downloading: boolean
  onPreview: () => void
  onDownload: () => void
  onManualPayment?: () => void
  onEdit?: () => void
}

export function BillingDocumentActions({
  mode,
  downloading,
  onPreview,
  onDownload,
  onManualPayment,
  onEdit,
}: DocumentActions) {
  const isIssued = mode === 'invoices'
  return (
    <div className="invoice-card-actions">
      <Button
        size="sm"
        variant="outline"
        className="invoice-preview-button"
        onClick={onPreview}
        aria-label={isIssued ? 'Ver factura' : 'Ver solicitud'}
      >
        <Eye size={15} />
        <span className="invoice-action-label">{isIssued ? 'Ver factura' : 'Ver solicitud'}</span>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="invoice-download-button"
        disabled={downloading}
        onClick={onDownload}
        aria-label={isIssued ? 'Descargar factura' : 'Descargar solicitud'}
      >
        <Download size={15} />
        <span className="invoice-download-label">
          {downloading ? 'Preparando…' : isIssued ? 'Descargar factura' : 'Descargar solicitud'}
        </span>
      </Button>
      {onEdit && (
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil size={15} /> Editar
        </Button>
      )}
      {!isIssued && onManualPayment && (
        <Button size="sm" variant="outline" onClick={onManualPayment}>
          <CheckCircle2 size={15} /> Registrar cobro
        </Button>
      )}
    </div>
  )
}

export function BillingDocumentCard({
  invoice,
  mode,
  clientName,
  downloading,
  onPreview,
  onDownload,
  onManualPayment,
  onOpenClient,
  onOpenLetter,
  onEdit,
}: {
  invoice: ClientInvoice
  mode: BillingDocumentMode
  clientName: string
  downloading: boolean
  onPreview: () => void
  onDownload: () => void
  onManualPayment?: () => void
  onOpenClient?: (clientId: string) => void
  onOpenLetter?: (letterId: string) => void
  onEdit?: () => void
}) {
  const isIssued = mode === 'invoices'
  const issued = isIssued ? invoice.issuedInvoice : undefined
  const clientId = invoice.clientId
  const letterId = invoice.letterId

  return (
    <Card className="invoice-card">
      <CardContent>
        <div className="invoice-card-main">
          <div className="invoice-card-identity">
            <div className="invoice-icon">
              <ReceiptText size={19} />
            </div>
            <div className="invoice-card-details">
              <span className="invoice-type">
                {isIssued ? 'Factura creada' : 'Solicitud de pago'}
              </span>
              <strong title={issued?.number ?? invoice.concept}>
                {issued?.number ?? invoice.concept}
              </strong>
              <small>
                <FileText size={13} />
                {onOpenClient && clientId ? (
                  <button
                    type="button"
                    className="invoice-card-link"
                    onClick={() => onOpenClient(clientId)}
                  >
                    {clientName}
                  </button>
                ) : (
                  <span>{clientName}</span>
                )}
                <span aria-hidden="true">·</span>
                {onOpenLetter && letterId ? (
                  <button
                    type="button"
                    className="invoice-card-link invoice-reference"
                    onClick={() => onOpenLetter(letterId)}
                  >
                    {letterId}
                  </button>
                ) : (
                  <span className="invoice-reference">{letterId ?? 'Factura libre'}</span>
                )}
              </small>
            </div>
          </div>
          <div className="invoice-card-financial">
            <div className="invoice-amount">
              <strong>{currency(invoice.total)}</strong>
              <span>
                {new Date(issued?.issuedAt ?? invoice.createdAt).toLocaleDateString('es-ES')}
              </span>
            </div>
            {!isIssued && (
              <span className="invoice-status invoice-pending">Pendiente de cobro</span>
            )}
            {isIssued && <span className="invoice-status">Pagada</span>}
          </div>
          <BillingDocumentActions
            mode={mode}
            downloading={downloading}
            onPreview={onPreview}
            onDownload={onDownload}
            onManualPayment={onManualPayment}
            onEdit={onEdit}
          />
        </div>
      </CardContent>
    </Card>
  )
}
