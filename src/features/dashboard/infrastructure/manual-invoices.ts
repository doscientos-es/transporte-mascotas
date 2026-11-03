import { requireSupabase } from '@/shared/infrastructure/supabase'
import type { ManualInvoiceInput } from '@/shared/types'

import { validateManualInvoice } from '../domain/invoice-values'

export async function createPaidManualInvoice(input: ManualInvoiceInput) {
  const invoice = validateManualInvoice(input)
  const { data, error } = await requireSupabase().functions.invoke('create-paid-manual-invoice', {
    body: invoice,
  })
  if (error) {
    const response = 'context' in error && error.context instanceof Response ? error.context : null
    const details = response ? await response.json().catch(() => null) : null
    throw new Error(
      details?.error || 'No se ha podido crear la factura. Puedes volver a intentarlo.',
    )
  }
  const result = data as {
    invoiceDraftId?: string
    documentPending?: boolean
    error?: string
  } | null
  if (!result?.invoiceDraftId || result.error)
    throw new Error(result?.error || 'No se ha podido confirmar la factura creada.')
  return { invoiceDraftId: result.invoiceDraftId, documentPending: Boolean(result.documentPending) }
}
