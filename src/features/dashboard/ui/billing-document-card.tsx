import { Button, Card, CardContent, IconButton } from '@doscientos/ui'
import { CheckCircle2, Download, Eye, FileText, Pencil, ReceiptText, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

import type { ClientInvoice } from '@/shared/types'
import { StatusBadge } from '@/shared/ui/status-badge'

import type { BillingDocumentMode } from './billing-document-types'

const currency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)

type DocumentActions = {
  mode: BillingDocumentMode
  downloading: boolean
  compact?: boolean
  onPreview: () => void
  onDownload: () => void
  onManualPayment?: () => void
  onRemovePaymentRequest?: () => void
  onEdit?: () => void
}

function DocumentAction({
  compact,
  label,
  text,
  icon,
  onClick,
  disabled,
  className,
  labelClassName,
}: {
  compact: boolean
  label: string
  text?: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
  labelClassName?: string
}) {
  if (compact) {
    return (
      <IconButton
        label={label}
        size="icon-sm"
        variant="outline"
        className={className}
        disabled={disabled}
        onClick={onClick}
      >
        {icon}
      </IconButton>
    )
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className={className}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
    >
      {icon}
      <span className={labelClassName}>{text ?? label}</span>
    </Button>
  )
}

export function BillingDocumentActions({
  mode,
  downloading,
  compact = false,
  onPreview,
  onDownload,
  onManualPayment,
  onRemovePaymentRequest,
  onEdit,
}: DocumentActions) {
  const isIssued = mode === 'invoices'
  return (
    <div className="invoice-card-actions">
      <DocumentAction
        compact={compact}
        label={isIssued ? 'Ver factura' : 'Ver solicitud'}
        icon={<Eye size={15} />}
        className="invoice-preview-button"
        labelClassName="invoice-action-label"
        onClick={onPreview}
      />
      <DocumentAction
        compact={compact}
        label={isIssued ? 'Descargar factura' : 'Descargar solicitud'}
        text={downloading ? 'Preparando…' : undefined}
        icon={<Download size={15} />}
        className="invoice-download-button"
        labelClassName="invoice-download-label"
        disabled={downloading}
        onClick={onDownload}
      />
      {onEdit && (
        <DocumentAction
          compact={compact}
          label="Editar factura"
          text="Editar"
          icon={<Pencil size={15} />}
          onClick={onEdit}
        />
      )}
      {!isIssued && onManualPayment && (
        <DocumentAction
          compact={compact}
          label="Registrar cobro"
          icon={<CheckCircle2 size={15} />}
          onClick={onManualPayment}
        />
      )}
      {!isIssued && onRemovePaymentRequest && (
        <DocumentAction
          compact={compact}
          label="Quitar solicitud de pago"
          icon={<Trash2 size={15} />}
          onClick={onRemovePaymentRequest}
        />
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
  onRemovePaymentRequest,
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
  onRemovePaymentRequest?: () => void
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
            {!isIssued && <StatusBadge status="pendiente_pago">Pendiente de cobro</StatusBadge>}
            {isIssued && (
              <StatusBadge status="pagada" className="gap-1.5">
                <CheckCircle2 size={13} aria-hidden="true" /> Pagada
              </StatusBadge>
            )}
          </div>
          <BillingDocumentActions
            mode={mode}
            downloading={downloading}
            onPreview={onPreview}
            onDownload={onDownload}
            onManualPayment={onManualPayment}
            onRemovePaymentRequest={onRemovePaymentRequest}
            onEdit={onEdit}
          />
        </div>
      </CardContent>
    </Card>
  )
}
