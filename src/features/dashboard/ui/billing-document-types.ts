import type { ClientInvoice, ManualPaymentMethod } from '@/shared/types'

export type BillingDocumentMode = 'payment-requests' | 'invoices'

export type BillingDocumentsPageProps = {
  onConfirmManualPayment?: (invoice: ClientInvoice, method: ManualPaymentMethod) => Promise<void>
  onOpenClient?: (clientId: string) => void
  onOpenLetter?: (letterId: string) => void
}
