import type { ClientInvoice } from '@/shared/types'

import { BillingDocumentActions } from './billing-document-card'

const currency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)

export function BillingDocumentTable({
  invoices,
  downloadingId,
  onPreview,
  onDownload,
  onEdit,
  onOpenClient,
  onOpenLetter,
}: {
  invoices: ClientInvoice[]
  downloadingId: string | null
  onPreview: (invoice: ClientInvoice) => void
  onDownload: (invoice: ClientInvoice) => void
  onEdit?: (invoice: ClientInvoice) => void
  onOpenClient?: (clientId: string) => void
  onOpenLetter?: (letterId: string) => void
}) {
  return (
    <div className="invoice-table-wrapper">
      <table className="invoice-table">
        <caption className="sr-only">Facturas</caption>
        <thead>
          <tr>
            <th scope="col">Factura</th>
            <th scope="col">Cliente</th>
            <th scope="col">Carta</th>
            <th scope="col">Fecha</th>
            <th scope="col">Importe</th>
            <th scope="col">Estado</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>
                <strong>{invoice.issuedInvoice?.number ?? invoice.concept}</strong>
              </td>
              <td>
                {onOpenClient && invoice.clientId ? (
                  <button
                    className="invoice-card-link"
                    onClick={() => onOpenClient(invoice.clientId)}
                  >
                    {invoice.clientName || 'Cliente'}
                  </button>
                ) : (
                  invoice.clientName || 'Cliente'
                )}
              </td>
              <td>
                {onOpenLetter && invoice.letterId ? (
                  <button
                    className="invoice-card-link"
                    onClick={() => {
                      if (invoice.letterId) onOpenLetter(invoice.letterId)
                    }}
                  >
                    {invoice.letterId}
                  </button>
                ) : (
                  (invoice.letterId ?? 'Factura libre')
                )}
              </td>
              <td>
                {new Date(invoice.issuedInvoice?.issuedAt ?? invoice.createdAt).toLocaleDateString(
                  'es-ES',
                )}
              </td>
              <td>{currency(invoice.total)}</td>
              <td>
                <span className="invoice-status">Pagada</span>
              </td>
              <td>
                <BillingDocumentActions
                  mode="invoices"
                  downloading={downloadingId === invoice.id}
                  onPreview={() => onPreview(invoice)}
                  onDownload={() => onDownload(invoice)}
                  onEdit={onEdit && invoice.issuedInvoice ? () => onEdit(invoice) : undefined}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
