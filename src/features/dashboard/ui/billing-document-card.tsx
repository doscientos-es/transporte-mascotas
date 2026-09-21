import { Button, Card, CardContent } from '@doscientos/ui'
import { CheckCircle2, Download, Eye, FileText, ReceiptText } from 'lucide-react'

import type { ClientInvoice } from '@/shared/types'

import type { BillingDocumentMode } from './billing-document-types'

const currency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)

export function BillingDocumentCard({
  invoice,
  mode,
  clientName,
  transportista,
  downloading,
  onPreview,
  onDownload,
  onManualPayment,
  onOpenClient,
  onOpenLetter,
}: {
  invoice: ClientInvoice
  mode: BillingDocumentMode
  clientName: string
  transportista: boolean
  downloading: boolean
  onPreview: () => void
  onDownload: () => void
  onManualPayment?: () => void
  onOpenClient?: (clientId: string) => void
  onOpenLetter?: (letterId: string) => void
}) {
  const isIssued = mode === 'invoices'
  const issued = isIssued ? invoice.issuedInvoice : undefined
  const clientId = invoice.clientId

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
                {isIssued ? 'Factura emitida' : 'Solicitud de pago'}
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
                {onOpenLetter ? (
                  <button
                    type="button"
                    className="invoice-card-link invoice-reference"
                    onClick={() => onOpenLetter(invoice.letterId)}
                  >
                    {invoice.letterId}
                  </button>
                ) : (
                  <span className="invoice-reference">{invoice.letterId}</span>
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
            {isIssued ? (
              <span className="invoice-status invoice-paid">
                <CheckCircle2 size={15} /> Emitida
              </span>
            ) : (
              <span className="invoice-status invoice-pending">Pendiente de cobro</span>
            )}
          </div>
        </div>
        <div className="invoice-card-actions">
          <Button
            size="sm"
            variant="outline"
            className="invoice-preview-button"
            onClick={onPreview}
          >
            <Eye size={15} /> {isIssued ? 'Ver factura' : 'Ver solicitud'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="invoice-download-button"
            disabled={downloading}
            onClick={onDownload}
          >
            <Download size={15} />{' '}
            {downloading ? 'Preparando…' : isIssued ? 'Descargar factura' : 'Descargar solicitud'}
          </Button>
          {!transportista && !isIssued && onManualPayment && (
            <Button size="sm" variant="outline" onClick={onManualPayment}>
              <CheckCircle2 size={15} /> Registrar cobro
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
