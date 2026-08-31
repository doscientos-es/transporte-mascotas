import { dispatchBillingNotifications } from '../_shared/billing-notifications.ts'
import { persistIssuedInvoiceDocument } from '../_shared/invoice-document.ts'
import { corsHeaders, json, requireAdmin, rest } from '../_shared/supabase.ts'

const paymentMethods = new Set(['Transferencia', 'Efectivo', 'Bizum', 'Tarjeta', 'Otro'])
type Invoice = {
  id: string
  status: string
  total_amount: string
  client_snapshot: Record<string, unknown>
}
type Payment = { id: string }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    const userId = await requireAdmin(request)
    const { invoiceId, paymentMethod } = (await request.json()) as {
      invoiceId?: string
      paymentMethod?: string
    }
    if (
      !invoiceId ||
      !/^[0-9a-f-]{36}$/i.test(invoiceId) ||
      !paymentMethod ||
      !paymentMethods.has(paymentMethod)
    )
      return json({ error: 'Datos de cobro no válidos.' }, 400)
    const invoiceResponse = await rest(
      `invoice_drafts?id=eq.${encodeURIComponent(invoiceId)}&select=id,status,total_amount,client_snapshot`,
    )
    const [invoice] = (await invoiceResponse.json()) as Invoice[]
    if (!invoice) return json({ error: 'Solicitud de pago no encontrada.' }, 404)
    if (invoice.status === 'emitida') {
      await persistIssuedInvoiceDocument(invoice.id, userId)
      try {
        await dispatchBillingNotifications(invoice.id, 'factura_emitida')
      } catch (error) {
        console.error(
          'Invoice notification deferred',
          error instanceof Error ? error.message : 'unknown error',
        )
      }
      return json({ alreadyIssued: true })
    }
    if (invoice.status !== 'solicitud_pago')
      return json({ error: 'Esta solicitud no admite cobros.' }, 409)
    validateFiscalClient(invoice.client_snapshot)
    const payment = await manualPayment(invoice)
    const paidAt = new Date().toISOString()
    const issuedResponse = await rest('rpc/confirm_invoice_payment', {
      method: 'POST',
      body: JSON.stringify({
        p_payment_id: payment.id,
        p_paid_at: paidAt,
        p_gateway_response: { paymentMethod, registeredAt: paidAt },
        p_issuer_snapshot: issuerSnapshot(),
      }),
    })
    const issuedInvoiceId = (await issuedResponse.json()) as string
    await persistIssuedInvoiceDocument(invoice.id, userId)
    try {
      await dispatchBillingNotifications(invoice.id, 'factura_emitida')
    } catch (error) {
      console.error(
        'Invoice notification deferred',
        error instanceof Error ? error.message : 'unknown error',
      )
    }
    return json({ issuedInvoiceId })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'No se ha podido registrar el cobro.' },
      500,
    )
  }
})

async function manualPayment(invoice: Invoice) {
  const existingResponse = await rest(
    `invoice_payments?invoice_id=eq.${encodeURIComponent(invoice.id)}&provider=eq.manual&select=id&limit=1`,
  )
  const [existing] = (await existingResponse.json()) as Payment[]
  if (existing) return existing
  const amountCents = Math.round(Number(invoice.total_amount) * 100)
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0)
    throw new Error('El importe de la solicitud no es válido.')
  const response = await rest('invoice_payments', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      invoice_id: invoice.id,
      provider: 'manual',
      merchant_order: `M${crypto.randomUUID().replaceAll('-', '').slice(0, 11)}`,
      amount_cents: amountCents,
    }),
  })
  const [payment] = (await response.json()) as Payment[]
  if (!payment) throw new Error('No se ha podido crear el registro de cobro.')
  return payment
}

function validateFiscalClient(client: Record<string, unknown>) {
  const required = ['fullName', 'nif', 'address', 'postalCode', 'city']
  if (required.some((field) => typeof client[field] !== 'string' || !client[field].trim()))
    throw new Error('Completa los datos fiscales antes de registrar el cobro.')
}

function issuerSnapshot() {
  const name = Deno.env.get('INVOICE_ISSUER_NAME')
  const taxId = Deno.env.get('INVOICE_ISSUER_TAX_ID')
  const address = Deno.env.get('INVOICE_ISSUER_ADDRESS')
  if (!name || !taxId || !address) throw new Error('Faltan los datos fiscales del emisor.')
  return { name, taxId, address }
}
