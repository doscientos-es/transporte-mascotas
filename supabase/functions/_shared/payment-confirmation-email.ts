import { escapeHtml, isValidEmail, sendEmail } from './resend.ts'
import { rest } from './supabase.ts'

type TransportRequest = {
  contact_name: string
  contact_email: string
  origin_text: string
  destination_text: string
  desired_date: string
  amount_cents: number
}
type InvoiceDraft = {
  concept: string
  total_amount: string
  client_snapshot: Record<string, unknown>
}
type Detail = [label: string, value: string]

/** Payment confirmation for a self-service transport request paid through Cyberpac. */
export async function sendTransportPaymentConfirmation(requestId: string, issuedInvoiceId: string) {
  const response = await rest(
    `transport_requests?id=eq.${encodeURIComponent(requestId)}&select=contact_name,contact_email,origin_text,destination_text,desired_date,amount_cents`,
  )
  const [request] = (await response.json()) as TransportRequest[]
  if (!request) throw new Error('No se ha encontrado la solicitud de transporte.')
  if (!isValidEmail(request.contact_email)) return null
  const invoiceNumber = await issuedInvoiceNumber(issuedInvoiceId)
  return sendConfirmation(request.contact_email, request.contact_name, issuedInvoiceId, [
    ['Trayecto', `${request.origin_text} → ${request.destination_text}`],
    ['Fecha de salida', formatDate(request.desired_date)],
    ['Importe pagado', formatAmount(request.amount_cents / 100)],
    ...(invoiceNumber ? ([['Factura', invoiceNumber]] as Detail[]) : []),
  ])
}

/** Payment confirmation for a payment request, whether paid by card or registered manually. */
export async function sendInvoicePaymentConfirmation(
  invoiceDraftId: string,
  issuedInvoiceId: string,
) {
  const response = await rest(
    `invoice_drafts?id=eq.${encodeURIComponent(invoiceDraftId)}&select=concept,total_amount,client_snapshot`,
  )
  const [invoice] = (await response.json()) as InvoiceDraft[]
  if (!invoice) throw new Error('No se ha encontrado la solicitud de pago.')
  const recipient = invoice.client_snapshot.email
  if (!isValidEmail(recipient)) return null
  const name =
    typeof invoice.client_snapshot.fullName === 'string' ? invoice.client_snapshot.fullName : ''
  const invoiceNumber = await issuedInvoiceNumber(issuedInvoiceId)
  return sendConfirmation(recipient, name, issuedInvoiceId, [
    ['Concepto', invoice.concept],
    ['Importe pagado', formatAmount(Number(invoice.total_amount))],
    ...(invoiceNumber ? ([['Factura', invoiceNumber]] as Detail[]) : []),
  ])
}

async function sendConfirmation(
  recipient: string,
  name: string,
  issuedInvoiceId: string,
  details: Detail[],
) {
  const greeting = name.trim() ? `Hola ${name.trim()},` : 'Hola,'
  const intro = 'Hemos recibido tu pago correctamente. Estos son los datos de la operación:'
  const closing = 'Gracias por confiar en Kache Envíos.'
  const rows = details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#555">${escapeHtml(label)}</td><td style="padding:4px 0"><strong>${escapeHtml(value)}</strong></td></tr>`,
    )
    .join('')
  return sendEmail({
    to: recipient.trim(),
    subject: 'Confirmación de pago - Kache Envíos',
    idempotencyKey: `payment-confirmation/${issuedInvoiceId}`,
    text: [greeting, '', intro, '', ...details.map(([l, v]) => `${l}: ${v}`), '', closing].join(
      '\n',
    ),
    html: `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(intro)}</p>
<table style="border-collapse:collapse">${rows}</table>
<p>${escapeHtml(closing)}</p>
</body></html>`,
  })
}

async function issuedInvoiceNumber(issuedInvoiceId: string) {
  const response = await rest(
    `issued_invoices?id=eq.${encodeURIComponent(issuedInvoiceId)}&select=number:fiscal_snapshot->>number`,
  )
  const [invoice] = (await response.json()) as Array<{ number: string | null }>
  return invoice?.number ?? null
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
