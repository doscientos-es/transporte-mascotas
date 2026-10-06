import { rest } from './supabase.ts'

type PaymentInvoice = { id: string; total_amount: string; client_snapshot: Record<string, unknown> }
export async function paymentUrl(invoiceId: string) {
  const payment = await createPayment(invoiceId)
  const url = Deno.env.get('SUPABASE_URL')
  if (!url) throw new Error('Falta SUPABASE_URL.')
  return `${url}/functions/v1/payment-redirect?token=${encodeURIComponent(payment.public_token)}`
}

async function createPayment(invoiceId: string) {
  requirePaymentConfiguration()
  const invoiceResponse = await rest(
    `invoice_drafts?id=eq.${encodeURIComponent(invoiceId)}&status=eq.solicitud_pago&select=id,total_amount,client_snapshot`,
  )
  const [invoice] = (await invoiceResponse.json()) as PaymentInvoice[]
  if (!invoice) throw new Error('La solicitud de pago ya no está disponible.')
  validateFiscalClient(invoice.client_snapshot)
  validateIssuer()
  const amountCents = Math.round(Number(invoice.total_amount) * 100)
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0)
    throw new Error('El importe de la solicitud no es válido.')
  const response = await rest('invoice_payments', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      invoice_id: invoice.id,
      merchant_order: `B${crypto.randomUUID().replaceAll('-', '').slice(0, 11)}`,
      amount_cents: amountCents,
    }),
  })
  const [payment] = (await response.json()) as Payment[]
  if (!payment) throw new Error('No se ha podido crear el enlace de pago.')
  return payment
}

function validateFiscalClient(client: Record<string, unknown>) {
  const required = ['fullName', 'nif', 'address', 'postalCode', 'city']
  if (required.some((field) => typeof client[field] !== 'string' || !client[field].trim()))
    throw new Error('Completa los datos fiscales antes de solicitar el cobro.')
}

function validateIssuer() {
  if (
    !Deno.env.get('INVOICE_ISSUER_NAME') ||
    !Deno.env.get('INVOICE_ISSUER_TAX_ID') ||
    !Deno.env.get('INVOICE_ISSUER_ADDRESS')
  )
    throw new Error('Faltan los datos fiscales del emisor.')
}

function requirePaymentConfiguration() {
  const required = [
    'CAIXABANK_CYBERPAC_MERCHANT_CODE',
    'CAIXABANK_CYBERPAC_TERMINAL',
    'CAIXABANK_CYBERPAC_SECRET',
    'CAIXABANK_CYBERPAC_ENDPOINT',
    'PUBLIC_APP_URL',
    'INVOICE_ISSUER_NAME',
    'INVOICE_ISSUER_TAX_ID',
    'INVOICE_ISSUER_ADDRESS',
  ]
  if (required.some((name) => !Deno.env.get(name)))
    throw new Error('Falta configurar la pasarela de CaixaBank o los datos fiscales del emisor.')
}
