import type { BillingDocumentsPageProps } from './billing-document-types'
import { BillingDocumentsPage } from './billing-documents-page'

export type InvoicesPageProps = BillingDocumentsPageProps

export function InvoicesPage(props: InvoicesPageProps) {
  return <BillingDocumentsPage mode="invoices" {...props} />
}
