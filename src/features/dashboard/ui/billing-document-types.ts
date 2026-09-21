import type { ClientInvoice, ManualPaymentMethod } from '@/shared/types'

export type BillingDocumentMode = 'payment-requests' | 'invoices'

export type BillingDocumentsPageProps = {
  transportista: boolean
  onConfirmManualPayment?: (invoice: ClientInvoice, method: ManualPaymentMethod) => Promise<void>
  onPaymentConfirmed?: (invoice: ClientInvoice) => void
  onOpenClient?: (clientId: string) => void
  onOpenLetter?: (letterId: string) => void
}
