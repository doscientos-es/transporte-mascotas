import { json, requireAdmin, rest } from '../_shared/supabase.ts';

type Invoice = { id: string; total_amount: string; status: string; client_snapshot: Record<string, unknown> }
type Payment = { public_token: string; status: string; expires_at: string }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok')
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    await requireAdmin(request)
    if (!isCyberpacConfigured()) return json({ error: 'Bizum para comercios de CaixaBank todavía no está configurado.' })
    const { invoiceId } = await request.json() as { invoiceId?: string }
    if (!invoiceId || !/^[0-9a-f-]{36}$/i.test(invoiceId)) return json({ error: 'Factura no válida.' }, 400)
    const invoiceResponse = await rest(`invoice_drafts?id=eq.${encodeURIComponent(invoiceId)}&select=id,total_amount,status,client_snapshot`)
    const [invoice] = await invoiceResponse.json() as Invoice[]
    if (!invoice) return json({ error: 'Factura no encontrada.' }, 404)
    if (invoice.status !== 'solicitud_pago') return json({ error: 'Esta solicitud ya no admite pagos.' }, 409)
    validateFiscalClient(invoice.client_snapshot)
    validateIssuer()

    const existingResponse = await rest(`invoice_payments?invoice_id=eq.${encodeURIComponent(invoice.id)}&status=eq.pendiente&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=public_token,status,expires_at&order=created_at.desc&limit=1`)
    const [existing] = await existingResponse.json() as Payment[]
    const payment = existing ?? await createPayment(invoice)
    const url = Deno.env.get('SUPABASE_URL')
    return json({ paymentUrl: `${url}/functions/v1/payment-redirect?token=${encodeURIComponent(payment.public_token)}` })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se ha podido crear el pago.' }, 500)
  }
})

function isCyberpacConfigured() {
  return Boolean(
    Deno.env.get('CAIXABANK_CYBERPAC_MERCHANT_CODE')
    && Deno.env.get('CAIXABANK_CYBERPAC_TERMINAL')
    && Deno.env.get('CAIXABANK_CYBERPAC_SECRET')
    && Deno.env.get('CAIXABANK_CYBERPAC_ENDPOINT')
    && Deno.env.get('PUBLIC_APP_URL'),
  )
}

function validateFiscalClient(client: Record<string, unknown>) {
  const required = ['fullName', 'nif', 'address', 'postalCode', 'city']
  if (required.some((field) => typeof client[field] !== 'string' || !client[field].trim())) throw new Error('Completa los datos fiscales antes de solicitar el cobro.')
}

function validateIssuer() {
  if (!Deno.env.get('INVOICE_ISSUER_NAME') || !Deno.env.get('INVOICE_ISSUER_TAX_ID') || !Deno.env.get('INVOICE_ISSUER_ADDRESS')) throw new Error('Faltan los datos fiscales del emisor.')
}

async function createPayment(invoice: Invoice) {
  const amountCents = Math.round(Number(invoice.total_amount) * 100)
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('El importe de la factura no es válido.')
  const merchantOrder = `B${crypto.randomUUID().replaceAll('-', '').slice(0, 11)}`
  const response = await rest('invoice_payments', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ invoice_id: invoice.id, merchant_order: merchantOrder, amount_cents: amountCents }),
  })
  const [payment] = await response.json() as Payment[]
  if (!payment) throw new Error('No se ha podido preparar el enlace de pago.')
  return payment
}
