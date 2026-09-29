import {
  transportInvitationIcs,
  googleCalendarUrl,
  type TransportEvent,
} from './calendar-invitation.ts'
import {
  type CarriageLetter,
  loadCarriageLetter,
  renderCarriageLetter,
} from './carriage-letter-document.ts'
import { fetchInvoiceDocument, persistIssuedInvoiceDocument } from './invoice-document.ts'
import { type Detail, paymentConfirmationEmail } from './payment-confirmation-template.ts'
import {
  type EmailAttachment,
  EmailError,
  isEmailConfigured,
  isValidEmail,
  senderAddress,
  sendEmail,
} from './resend.ts'
import { rest } from './supabase.ts'

type InvoiceDraft = {
  letter_id: string
  concept: string
  total_amount: string
  client_snapshot: Record<string, unknown>
}
type Recipient = { email: string; name: string }

/** Payment confirmation for a self-service transport request paid through Cyberpac. */
export async function sendTransportPaymentConfirmation(requestId: string, issuedInvoiceId: string) {
  const response = await rest(
    `transport_requests?id=eq.${encodeURIComponent(requestId)}&select=contact_name,contact_email`,
  )
  const [request] = (await response.json()) as Array<{
    contact_name: string
    contact_email: string
  }>
  if (!request) throw new Error('No se ha encontrado la solicitud de transporte.')
  if (!isValidEmail(request.contact_email)) return null
  const invoiceResponse = await rest(
    `issued_invoices?id=eq.${encodeURIComponent(issuedInvoiceId)}&select=invoice_draft_id`,
  )
  const [invoice] = (await invoiceResponse.json()) as Array<{ invoice_draft_id: string }>
  if (!invoice) throw new Error('No se ha encontrado la factura emitida.')
  return sendConfirmation(
    { email: request.contact_email.trim(), name: request.contact_name },
    invoice.invoice_draft_id,
    issuedInvoiceId,
  )
}

/** Payment confirmation for a payment request, whether paid by card or registered manually. */
export async function sendInvoicePaymentConfirmation(
  invoiceDraftId: string,
  issuedInvoiceId: string,
) {
  const draft = await loadInvoiceDraft(invoiceDraftId)
  const recipient = draft.client_snapshot.email
  if (!isValidEmail(recipient)) return null
  const name =
    typeof draft.client_snapshot.fullName === 'string' ? draft.client_snapshot.fullName : ''
  return sendConfirmation({ email: recipient.trim(), name }, invoiceDraftId, issuedInvoiceId, draft)
}

async function loadInvoiceDraft(invoiceDraftId: string) {
  const response = await rest(
    `invoice_drafts?id=eq.${encodeURIComponent(invoiceDraftId)}&select=letter_id,concept,total_amount,client_snapshot`,
  )
  const [draft] = (await response.json()) as InvoiceDraft[]
  if (!draft) throw new Error('No se ha encontrado la solicitud de pago.')
  return draft
}

/**
 * Sends the confirmation with the invoice PDF, the carriage letter PDF and a
 * calendar invitation. A document that cannot be prepared is logged and left
 * out rather than blocking the confirmation.
 */
async function sendConfirmation(
  recipient: Recipient,
  invoiceDraftId: string,
  issuedInvoiceId: string,
  loadedDraft?: InvoiceDraft,
) {
  if (!isEmailConfigured())
    throw new EmailError('El envío de emails todavía no está configurado.', true)
  const draft = loadedDraft ?? (await loadInvoiceDraft(invoiceDraftId))
  const [invoiceNumber, letter] = await Promise.all([
    issuedInvoiceNumber(issuedInvoiceId),
    optional('Carriage letter not loaded', () => loadCarriageLetter(draft.letter_id)),
  ])
  const attachments: Array<EmailAttachment & { label: string }> = []

  const invoicePdf = await optional('Invoice PDF not attached', async () => {
    const document = await persistIssuedInvoiceDocument(invoiceDraftId)
    const response = await fetchInvoiceDocument(document)
    return { fileName: document.file_name, body: new Uint8Array(await response.arrayBuffer()) }
  })
  if (invoicePdf)
    attachments.push({
      label: `Factura${invoiceNumber ? ` ${invoiceNumber}` : ''} (PDF)`,
      filename: invoicePdf.fileName,
      content: invoicePdf.body,
      contentType: 'application/pdf',
    })

  const letterPdf = letter
    ? await optional('Carriage letter PDF not attached', () => renderCarriageLetter(letter))
    : null
  if (letter && letterPdf)
    attachments.push({
      label: `Carta de porte ${letter.id.replace(/^CARTA DE PORTE\s*/i, '')} (PDF)`,
      filename: letterPdf.fileName,
      content: letterPdf.body,
      contentType: 'application/pdf',
    })

  const event = letter ? transportEvent(letter) : null
  const organizer = senderAddress()
  if (event)
    attachments.push({
      label: 'Invitación de calendario (.ics)',
      filename: 'transporte-kache-envios.ics',
      content: transportInvitationIcs(event, {
        organizer: isValidEmail(organizer) ? organizer : '',
        attendee: recipient.email,
        attendeeName: recipient.name,
      }),
      contentType: `text/calendar; charset=utf-8; method=${isValidEmail(organizer) ? 'REQUEST' : 'PUBLISH'}`,
    })

  const appUrl = Deno.env.get('PUBLIC_APP_URL')?.replace(/\/$/, '')
  const email = paymentConfirmationEmail({
    name: recipient.name,
    invoiceNumber,
    details: confirmationDetails(draft, letter, invoiceNumber),
    attachments: attachments.map(({ label }) => label),
    hasCalendarInvitation: Boolean(event),
    portalUrl: appUrl ? `${appUrl}/mis-transportes` : null,
    calendarUrl: event ? googleCalendarUrl(event) : null,
  })
  return sendEmail({
    to: recipient.email,
    ...email,
    attachments: attachments.map(({ label: _label, ...attachment }) => attachment),
    idempotencyKey: `payment-confirmation/${issuedInvoiceId}`,
  })
}

function confirmationDetails(
  draft: InvoiceDraft,
  letter: CarriageLetter | null,
  invoiceNumber: string | null,
): Detail[] {
  const details: Detail[] = [['Concepto', draft.concept]]
  if (letter) {
    details.push(
      ['Trayecto', `${letter.origin_text} → ${letter.destination_text}`],
      ['Fecha del transporte', formatDate(letter.service_date)],
    )
    const animals = letter.animals
      .map((animal) => [animal.species, animal.breed].filter(Boolean).join(' · '))
      .filter(Boolean)
    if (animals.length)
      details.push([animals.length > 1 ? 'Mascotas' : 'Mascota', animals.join(', ')])
  }
  details.push(['Importe pagado', formatAmount(Number(draft.total_amount))])
  if (invoiceNumber) details.push(['Factura', invoiceNumber])
  return details
}

function transportEvent(letter: CarriageLetter): TransportEvent {
  const pickup = [letter.origin_text, letter.origin_point].filter(Boolean).join(' · ')
  const delivery = [letter.destination_text, letter.destination_point].filter(Boolean).join(' · ')
  return {
    uid: `${letter.id.replace(/[^a-zA-Z0-9-]+/g, '-')}@kache-envios`,
    date: letter.service_date,
    title: `Transporte Kache Envíos: ${letter.origin_text} → ${letter.destination_text}`,
    description: `Recogida: ${pickup}\nEntrega: ${delivery}\n${letter.id}\n\nTe avisaremos con la hora aproximada de recogida.`,
    location: pickup,
  }
}

async function optional<T>(context: string, task: () => Promise<T>): Promise<T | null> {
  try {
    return await task()
  } catch (error) {
    console.error(context, error instanceof Error ? error.message : 'unknown error')
    return null
  }
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
