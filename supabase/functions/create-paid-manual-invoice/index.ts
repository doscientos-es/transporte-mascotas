import { persistIssuedInvoiceDocument } from '../_shared/invoice-document.ts'
import { requireInvoiceIssuerSnapshot } from '../_shared/invoice-issuer.ts'
import { corsHeaders, json, requireAdmin, rest } from '../_shared/supabase.ts'

type Input = {
  id?: string
  client?: Record<string, unknown>
  concept?: string
  total?: number
  operationDate?: string
  paymentMethod?: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    const userId = await requireAdmin(request)
    const input = (await request.json().catch(() => null)) as Input | null
    if (
      !input ||
      typeof input.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id) ||
      !input.client ||
      typeof input.client !== 'object' ||
      Array.isArray(input.client) ||
      typeof input.concept !== 'string' ||
      !input.concept.trim() ||
      input.concept.trim().length > 500 ||
      typeof input.total !== 'number' ||
      !Number.isFinite(input.total) ||
      input.total <= 0 ||
      input.total > 999999.99 ||
      Math.abs(input.total * 100 - Math.round(input.total * 100)) > 0.000001 ||
      typeof input.operationDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.operationDate) ||
      !['Transferencia', 'Bizum', 'Tarjeta'].includes(input.paymentMethod ?? '')
    )
      return json({ error: 'Revisa los datos de la factura y del cobro.' }, 400)

    const issuer = requireInvoiceIssuerSnapshot()
    const response = await rest('rpc/create_paid_manual_invoice', {
      method: 'POST',
      body: JSON.stringify({
        p_invoice_id: input.id,
        p_actor_id: userId,
        p_client: input.client,
        p_concept: input.concept,
        p_total: input.total,
        p_operation_date: input.operationDate,
        p_payment_method: input.paymentMethod,
        p_issuer_snapshot: issuer,
      }),
    })
    const result = (await response.json()) as { invoiceDraftId: string; issuedInvoiceId: string }
    if (!result.invoiceDraftId || !result.issuedInvoiceId)
      throw new Error('No se ha podido confirmar la emisión.')
    let documentPending = false
    try {
      await persistIssuedInvoiceDocument(result.invoiceDraftId, userId)
    } catch {
      // Issuance already committed: a document failure must never invite a second invoice.
      documentPending = true
    }
    return json({ invoiceDraftId: result.invoiceDraftId, documentPending })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se ha podido crear la factura.'
    const status =
      message === 'No autenticado.'
        ? 401
        : message === 'No tienes permisos para generar pagos.'
          ? 403
          : 500
    return json({ error: message }, status)
  }
})
