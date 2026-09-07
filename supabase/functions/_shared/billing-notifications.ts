import { rest } from './supabase.ts'
import { isRetryableWhatsAppError, sendWhatsAppTemplate } from './whatsapp.ts'

type Payment = { public_token: string }
type PaymentInvoice = { id: string; total_amount: string; client_snapshot: Record<string, unknown> }
type Notification = {
  id: string
  invoice_draft_id: string
  channel: 'email' | 'whatsapp'
  recipient: string
  kind: 'solicitud_pago' | 'factura_emitida'
  issued_invoice_id: string | null
  attempts: number
}
type IssuedInvoice = {
  series: string
  fiscal_year: number
  sequence_number: number
  public_token: string
  document_expires_at: string
}

export async function paymentUrl(invoiceId: string) {
  const existingResponse = await rest(
    `invoice_payments?invoice_id=eq.${encodeURIComponent(invoiceId)}&status=eq.pendiente&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=public_token&order=created_at.desc&limit=1`,
  )
  const [existing] = (await existingResponse.json()) as Payment[]
  const payment = existing ?? (await createPayment(invoiceId))
  const url = Deno.env.get('SUPABASE_URL')
  if (!url) throw new Error('Falta SUPABASE_URL.')
  return `${url}/functions/v1/payment-redirect?token=${encodeURIComponent(payment.public_token)}`
}

export async function dispatchBillingNotifications(
  invoiceId?: string,
  kind?: Notification['kind'],
) {
  const claimResponse = await rest('rpc/claim_billing_notifications', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ p_invoice_draft_id: invoiceId ?? null, p_kind: kind ?? null }),
  })
  const notifications = (await claimResponse.json()) as Notification[]
  if (!notifications.length) return { sent: 0, failed: 0 }
  let sent = 0
  let failed = 0
  for (const notification of notifications) {
    try {
      const link =
        notification.kind === 'solicitud_pago'
          ? await paymentUrl(notification.invoice_draft_id)
          : await invoiceUrl(notification.issued_invoice_id)
      if (!link) throw new Error('No se ha encontrado la factura emitida.')
      const messageId = await sendWhatsApp(notification.recipient, notification.kind, link)
      await updateNotification(notification.id, {
        status: 'enviada',
        provider_message_id: messageId,
        sent_at: new Date().toISOString(),
        processing_started_at: null,
      })
      sent++
    } catch (error) {
      await updateNotification(notification.id, failure(notification, error))
      failed++
    }
  }
  return { sent, failed }
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

async function invoiceUrl(issuedInvoiceId: string | null) {
  if (!issuedInvoiceId) return null
  const response = await rest(
    `issued_invoices?id=eq.${encodeURIComponent(issuedInvoiceId)}&select=public_token`,
  )
  const [invoice] = (await response.json()) as Pick<
    IssuedInvoice,
    'public_token' | 'document_expires_at'
  >[]
  if (!invoice) return null
  await rest(`issued_invoices?id=eq.${encodeURIComponent(issuedInvoiceId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      document_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  })
  const url = Deno.env.get('SUPABASE_URL')
  if (!url) throw new Error('Falta SUPABASE_URL.')
  return `${url}/functions/v1/issued-invoice?token=${encodeURIComponent(invoice.public_token)}`
}

async function sendWhatsApp(recipient: string, kind: Notification['kind'], link: string) {
  const templateEnvironmentVariable =
    kind === 'solicitud_pago' ? 'META_WHATSAPP_PAYMENT_TEMPLATE' : 'META_WHATSAPP_INVOICE_TEMPLATE'
  const firstValue = kind === 'solicitud_pago' ? 'Tu solicitud de pago' : 'Tu factura emitida'
  return sendWhatsAppTemplate(recipient, templateEnvironmentVariable, [
    { type: 'text', text: firstValue },
    { type: 'text', text: link },
  ])
}

async function updateNotification(id: string, body: Record<string, unknown>) {
  await rest(`billing_notifications?id=eq.${encodeURIComponent(id)}&status=eq.procesando`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

function failure(notification: Notification, error: unknown) {
  const retry = isRetryableWhatsAppError(error) && notification.attempts < 5
  return {
    status: retry ? 'fallida' : 'fallida_final',
    error_message: safeMessage(error),
    processing_started_at: null,
    ...(retry ? { scheduled_for: nextAttempt(notification.attempts).toISOString() } : {}),
  }
}

function nextAttempt(attempt: number) {
  return new Date(Date.now() + Math.min(6 * 60, 2 ** attempt) * 60_000)
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
    throw new Error('Falta configurar CaixaBank o los datos fiscales del emisor.')
}

function safeMessage(error: unknown) {
  return (error instanceof Error ? error.message : 'Error de entrega.').slice(0, 500)
}
