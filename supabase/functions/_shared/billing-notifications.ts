import { rest } from './supabase.ts'
import { sendWhatsAppTemplate } from './whatsapp.ts'

type Payment = { public_token: string }
type PaymentInvoice = { id: string; total_amount: string; client_snapshot: Record<string, unknown> }
type Notification = {
  id: string
  channel: 'email' | 'whatsapp'
  recipient: string
  kind: 'solicitud_pago' | 'factura_emitida'
  issued_invoice_id: string | null
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
  invoiceId: string,
  kind: Notification['kind'],
  paymentLink?: string,
) {
  const claimResponse = await rest('rpc/claim_billing_notifications', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ p_invoice_draft_id: invoiceId, p_kind: kind }),
  })
  const notifications = (await claimResponse.json()) as Notification[]
  let sent = 0
  let failed = 0
  for (const notification of notifications) {
    try {
      const link =
        kind === 'solicitud_pago' ? paymentLink : await invoiceUrl(notification.issued_invoice_id)
      if (!link) throw new Error('No se ha encontrado la factura emitida.')
      const messageId =
        notification.channel === 'email'
          ? await sendEmail(notification.recipient, kind, link)
          : await sendWhatsApp(notification.recipient, kind, link)
      await updateNotification(notification.id, {
        status: 'enviada',
        provider_message_id: messageId,
        sent_at: new Date().toISOString(),
        processing_started_at: null,
      })
      sent++
    } catch (error) {
      await updateNotification(notification.id, {
        status: 'fallida',
        error_message: safeMessage(error),
        processing_started_at: null,
      })
      failed++
    }
  }
  return { sent, failed }
}

async function createPayment(invoiceId: string) {
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

async function sendEmail(recipient: string, kind: Notification['kind'], link: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM')
  if (!key || !from) throw new Error('Resend todavía no está configurado.')
  const subject =
    kind === 'solicitud_pago' ? 'Solicitud de pago por Bizum' : 'Tu factura ya está disponible'
  const label = kind === 'solicitud_pago' ? 'Pagar de forma segura con Bizum' : 'Ver factura'
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject,
      html: `<p>${kind === 'solicitud_pago' ? 'Puedes abonar el servicio de forma segura.' : 'El pago se ha confirmado y tu factura está disponible.'}</p><p><a href="${link}">${label}</a></p>`,
      text: `${label}: ${link}`,
    }),
  })
  if (!response.ok) throw new Error(`Resend ha rechazado el envío (${response.status}).`)
  const result = (await response.json()) as { id?: string }
  return result.id ?? ''
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
  await rest(`billing_notifications?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

function safeMessage(error: unknown) {
  return (error instanceof Error ? error.message : 'Error de entrega.').slice(0, 500)
}
