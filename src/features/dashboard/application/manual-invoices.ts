export { cancelManualInvoice, createPaidManualInvoice } from '../infrastructure/manual-invoices'

import type { ClientInvoice } from '@/shared/types'

export function canCancelManualInvoice(invoice: ClientInvoice) {
  return Boolean(
    invoice.issuedInvoice &&
    !invoice.letterId &&
    invoice.payer === 'manual' &&
    !invoice.cancelledAt,
  )
}
