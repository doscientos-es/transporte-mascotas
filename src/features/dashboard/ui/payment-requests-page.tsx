import type { BillingDocumentsPageProps } from './billing-document-types'
import { BillingDocumentsPage } from './billing-documents-page'

export type PaymentRequestsPageProps = BillingDocumentsPageProps

export function PaymentRequestsPage(props: PaymentRequestsPageProps) {
  return <BillingDocumentsPage mode="payment-requests" {...props} />
}
