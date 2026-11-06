import { requireSupabase } from '@/shared/infrastructure/supabase'
import type { InvoiceClientInput, IssuedInvoice } from '@/shared/types'

import { fiscalClient } from '../domain/invoice-values'

export async function editInvoice(
  invoice: IssuedInvoice,
  client: InvoiceClientInput,
  concept: string,
  operationDate: string,
) {
  const normalizedClient = fiscalClient(client)
  if (!concept.trim() || concept.trim().length > 500)
    throw new Error('Indica un concepto de hasta 500 caracteres.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(operationDate))
    throw new Error('Indica una fecha de operación válida.')
  const { data, error } = await requireSupabase().functions.invoke('edit-issued-invoice', {
    body: {
      invoiceId: invoice.invoiceDraftId,
      expectedSnapshot: invoice.fiscalSnapshot,
      client: normalizedClient,
      concept: concept.trim(),
      operationDate,
    },
  })
  if (error) {
    const response = 'context' in error && error.context instanceof Response ? error.context : null
    const details = response ? await response.json().catch(() => null) : null
    throw new Error(details?.error || 'No se ha podido guardar la factura.')
  }
  if (!data?.invoiceId) throw new Error('No se ha podido confirmar la edición de la factura.')
}
