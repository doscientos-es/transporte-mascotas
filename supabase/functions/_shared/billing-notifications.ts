import { rest } from './supabase.ts'
import { sendWhatsAppTemplate } from './whatsapp.ts'

type Payment = { public_token: string }
type PaymentInvoice = { id: string; total_amount: string; client_snapshot: Record<string, unknown> }
type DeliveryInvoice = { delivery_phone: string; client_snapshot: Record<string, unknown> }
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
  if (!notifications.length) return { sent: 0, failed: 0 }

  try {
    const link =
      kind === 'solicitud_pago' ? paymentLink : await invoiceUrl(notifications[0].issued_invoice_id)
    if (!link) throw new Error('No se ha encontrado la factura emitida.')
    const messageId = await sendWhatsApp(
      await whatsappRecipient(invoiceId, notifications),
      kind,
      link,
    )
    await Promise.all(
      notifications.map((notification) =>
        updateNotification(notification.id, {
          status: 'enviada',
          provider_message_id: messageId,
          sent_at: new Date().toISOString(),
          processing_started_at: null,
        }),
      ),
    )
    return { sent: 1, failed: 0 }
  } catch (error) {
    await Promise.all(
      notifications.map((notification) =>
        updateNotification(notification.id, {
          status: 'fallida',
          error_message: safeMessage(error),
          processing_started_at: null,
        }),
      ),
    )
    return { sent: 0, failed: 1 }
  }
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

async function sendWhatsApp(recipient: string, kind: Notification['kind'], link: string) {
  const templateEnvironmentVariable =
    kind === 'solicitud_pago' ? 'META_WHATSAPP_PAYMENT_TEMPLATE' : 'META_WHATSAPP_INVOICE_TEMPLATE'
  const firstValue = kind === 'solicitud_pago' ? 'Tu solicitud de pago' : 'Tu factura emitida'
  return sendWhatsAppTemplate(recipient, templateEnvironmentVariable, [
    { type: 'text', text: firstValue },
    { type: 'text', text: link },
  ])
}

async function whatsappRecipient(invoiceId: string, notifications: Notification[]) {
  const queuedPhone = notifications.find(
    (notification) => notification.channel === 'whatsapp',
  )?.recipient
  if (queuedPhone?.trim()) return queuedPhone

  const response = await rest(
    `invoice_drafts?id=eq.${encodeURIComponent(invoiceId)}&select=delivery_phone,client_snapshot`,
  )
  const [invoice] = (await response.json()) as DeliveryInvoice[]
  const snapshotPhone = invoice?.client_snapshot.phone
  const recipient =
    invoice?.delivery_phone.trim() || (typeof snapshotPhone === 'string' && snapshotPhone.trim())
  if (!recipient) throw new Error('No hay un móvil de WhatsApp para entregar el documento.')
  return recipient
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
