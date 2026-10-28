import { persistIssuedInvoiceDocument } from '../_shared/invoice-document.ts'
import { sendInvoicePaymentConfirmation } from '../_shared/payment-confirmation-email.ts'
import { corsHeaders, json, requireAdmin, rest } from '../_shared/supabase.ts'

const paymentMethods = new Set(['Transferencia', 'Bizum', 'Tarjeta'])
type CreatedPaidLetter = { letterId: string; invoiceDraftId: string; issuedInvoiceId: string }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    const userId = await requireAdmin(request)
    const { letterArguments, paymentMethod } = (await request.json()) as {
      letterArguments?: Record<string, unknown>
      paymentMethod?: string
    }
    if (
      !letterArguments ||
      typeof letterArguments !== 'object' ||
      !paymentMethod ||
      !paymentMethods.has(paymentMethod)
    )
      return json({ error: 'Datos de creación o cobro no válidos.' }, 400)

    const rpcArguments = {
      ...letterArguments,
      p_payment_method: paymentMethod,
      p_issuer_snapshot: issuerSnapshot(),
    }
    const result = await createPaidLetterAsUser(request, rpcArguments)
    if (!result?.letterId || !result.invoiceDraftId || !result.issuedInvoiceId)
      throw new Error('No se ha podido confirmar la factura emitida.')

    let documentPending = false
    try {
      await persistIssuedInvoiceDocument(result.invoiceDraftId, userId)
    } catch (error) {
      documentPending = true
      console.error('Issued invoice document not persisted', errorMessage(error))
    }
    try {
      await sendInvoicePaymentConfirmation(result.invoiceDraftId, result.issuedInvoiceId)
    } catch (error) {
      console.error('Payment confirmation email not sent', errorMessage(error))
    }
    return json({
      letterId: result.letterId,
      invoiceDraftId: result.invoiceDraftId,
      documentPending,
    })
  } catch (error) {
    const message = errorMessage(error)
    return json({ error: message }, message === 'No autenticado.' ? 401 : 500)
  }
})

async function createPaidLetterAsUser(
  request: Request,
  rpcArguments: Record<string, unknown>,
): Promise<CreatedPaidLetter> {
  const baseUrl = Deno.env.get('SUPABASE_URL')
  const apiKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('authorization')
  if (!baseUrl || !apiKey || !authorization) throw new Error('No autenticado.')
  const response = await fetch(`${baseUrl}/rest/v1/rpc/create_paid_manual_carriage_letter`, {
    method: 'POST',
    headers: { apikey: apiKey, Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify(rpcArguments),
  })
  if (!response.ok) {
    const details = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(
      details?.message || `No se ha podido crear y emitir la carta (${response.status}).`,
    )
  }
  return (await response.json()) as CreatedPaidLetter
}

function issuerSnapshot() {
  const name = Deno.env.get('INVOICE_ISSUER_NAME')
  const taxId = Deno.env.get('INVOICE_ISSUER_TAX_ID')
  const address = Deno.env.get('INVOICE_ISSUER_ADDRESS')
  if (!name || !taxId || !address) throw new Error('Faltan los datos fiscales del emisor.')
  return { name, taxId, address }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se ha podido crear y emitir la carta.'
}
