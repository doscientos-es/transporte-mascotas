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
  letter_id: string | null
  concept: string
  total_amount: string
  client_snapshot: Record<string, unknown>
}
type Side = 'pickup' | 'delivery'
type Recipient = { email: string; name: string; isPayer: boolean; sides: Side[] }

/** Payment confirmation for a self-service transport request paid through Cyberpac. */
export async function sendTransportPaymentConfirmation(requestId: string, issuedInvoiceId: string) {
  const requestResponse = await rest(
    `transport_requests?id=eq.${encodeURIComponent(requestId)}&select=letter_id`,
  )
  const [request] = (await requestResponse.json()) as Array<{ letter_id: string | null }>
  if (!request?.letter_id) throw new Error('La solicitud no tiene carta de porte.')
  const invoiceResponse = await rest(
    `issued_invoices?id=eq.${encodeURIComponent(issuedInvoiceId)}&select=invoice_draft_id`,
  )
  const [invoice] = (await invoiceResponse.json()) as Array<{ invoice_draft_id: string }>
  if (!invoice) throw new Error('No se ha encontrado la factura.')
  const draft = await loadInvoiceDraft(invoice.invoice_draft_id)
  if (draft.letter_id !== request.letter_id)
    throw new Error('La factura no corresponde a la solicitud de transporte.')
  const letter = await loadCarriageLetter(request.letter_id)
  if (!letter) throw new Error('No se ha encontrado la carta de porte.')
  return sendConfirmations(draft, letter, issuedInvoiceId, invoice.invoice_draft_id)
}

/** Payment confirmation for a payment request, whether paid by card or registered manually. */
export async function sendInvoicePaymentConfirmation(
  invoiceDraftId: string,
  issuedInvoiceId: string,
) {
  const draft = await loadInvoiceDraft(invoiceDraftId)
  const letter = draft.letter_id ? await loadCarriageLetter(draft.letter_id) : null
  if (draft.letter_id && !letter) throw new Error('No se ha encontrado la carta de porte.')
  return sendConfirmations(draft, letter, issuedInvoiceId, invoiceDraftId)
}

/** Called only after the admin endpoint verifies that the letter is complimentary. */
export async function sendComplimentaryLetterConfirmation(letterId: string) {
  const letter = await loadCarriageLetter(letterId)
  if (!letter) throw new Error('No se ha encontrado la carta de porte.')
  return sendConfirmations(null, letter, null, null)
}

async function loadInvoiceDraft(invoiceDraftId: string) {
  const response = await rest(
    `invoice_drafts?id=eq.${encodeURIComponent(invoiceDraftId)}&select=letter_id,concept,total_amount,client_snapshot`,
  )
  const [draft] = (await response.json()) as InvoiceDraft[]
  if (!draft) throw new Error('No se ha encontrado la solicitud de pago.')
  return draft
}

export function confirmationRecipients(draft: InvoiceDraft | null, letter: CarriageLetter | null) {
  const recipients = new Map<string, Recipient>()
  const add = (email: unknown, name: string, isPayer: boolean, sides: Side[]) => {
    if (!isValidEmail(email)) return
    const key = email.trim().toLowerCase()
    const existing = recipients.get(key)
    if (existing) {
      existing.isPayer ||= isPayer
      for (const side of sides) if (!existing.sides.includes(side)) existing.sides.push(side)
    } else recipients.set(key, { email: email.trim(), name, isPayer, sides: [...sides] })
  }
  if (letter) {
    add(letter.sender_email, letter.sender_name, false, ['pickup'])
    add(letter.recipient_email, letter.recipient_name, false, ['delivery'])
  }
  if (draft) {
    const name =
      typeof draft.client_snapshot.fullName === 'string' ? draft.client_snapshot.fullName : ''
    // A distinct billing address receives both locations; never disclose the invoice to another address.
    const payerKey =
      typeof draft.client_snapshot.email === 'string'
        ? draft.client_snapshot.email.trim().toLowerCase()
        : ''
    add(
      draft.client_snapshot.email,
      name,
      true,
      letter && !recipients.has(payerKey) ? ['pickup', 'delivery'] : [],
    )
  }
  return [...recipients.values()]
}

async function sendConfirmations(
  draft: InvoiceDraft | null,
  letter: CarriageLetter | null,
  issuedInvoiceId: string | null,
  invoiceDraftId: string | null,
) {
  const recipients = confirmationRecipients(draft, letter)
  if (!recipients.length) return null
  if (!isEmailConfigured())
    throw new EmailError('El envío de emails todavía no está configurado.', true)
  const letterPdf = letter ? await renderCarriageLetter(letter) : null
  const invoiceNumber = issuedInvoiceId ? await issuedInvoiceNumber(issuedInvoiceId) : null
  // A failed invoice does not prevent the other party receiving their documentation.
  const invoiceResult =
    invoiceDraftId && recipients.some((recipient) => recipient.isPayer)
      ? await Promise.allSettled([
          (async () => {
            const document = await persistIssuedInvoiceDocument(invoiceDraftId)
            const response = await fetchInvoiceDocument(document)
            return {
              fileName: document.file_name,
              body: new Uint8Array(await response.arrayBuffer()),
            }
          })(),
        ])
      : []
  const invoice = invoiceResult[0]
  const outcomes = await Promise.allSettled(
    recipients.map(async (recipient) => {
      if (recipient.isPayer && invoice?.status === 'rejected') throw invoice.reason
      const attachments: Array<EmailAttachment & { label: string }> = []
      if (recipient.isPayer && invoice?.status === 'fulfilled')
        attachments.push({
          label: `Factura${invoiceNumber ? ` ${invoiceNumber}` : ''} (PDF)`,
          filename: invoice.value.fileName,
          content: invoice.value.body,
          contentType: 'application/pdf',
        })
      if (letter && letterPdf)
        attachments.push({
          label: `Carta de porte ${letter.id.replace(/^CARTA DE PORTE\s*/i, '')} (PDF)`,
          filename: letterPdf.fileName,
          content: letterPdf.body,
          contentType: 'application/pdf',
        })
      const locations = letter ? recipient.sides.map((side) => transportLocation(letter, side)) : []
      const event = letter ? transportEvent(letter, locations) : null
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
        invoiceNumber: recipient.isPayer ? invoiceNumber : null,
        isPayer: recipient.isPayer,
        hasPayment: Boolean(draft),
        locations,
        details: confirmationDetails(
          draft,
          letter,
          recipient.isPayer ? invoiceNumber : null,
          recipient.isPayer,
        ),
        attachments: attachments.map(({ label }) => label),
        hasCalendarInvitation: Boolean(event),
        portalUrl: appUrl && letter ? `${appUrl}/mis-transportes` : null,
        calendarUrl: event ? googleCalendarUrl(event) : null,
      })
      const hash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(
          `${issuedInvoiceId ?? letter?.id}/${recipient.email.toLowerCase()}`,
        ),
      )
      const recipientKey = Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('')
      return sendEmail({
        to: recipient.email,
        ...email,
        attachments: attachments.map(({ label: _label, ...attachment }) => attachment),
        idempotencyKey: `confirmation/${recipientKey}`,
      })
    }),
  )
  const failure = outcomes.find((result) => result.status === 'rejected')
  if (failure?.status === 'rejected') throw failure.reason
  return outcomes.length
}

function confirmationDetails(
  draft: InvoiceDraft | null,
  letter: CarriageLetter | null,
  invoiceNumber: string | null,
  isPayer: boolean,
): Detail[] {
  const details: Detail[] = draft && isPayer ? [['Concepto', draft.concept]] : []
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
  if (draft && isPayer) details.push(['Importe pagado', formatAmount(Number(draft.total_amount))])
  if (invoiceNumber) details.push(['Factura', invoiceNumber])
  return details
}

function transportLocation(letter: CarriageLetter, side: Side) {
  const pickup = side === 'pickup'
  const locality = pickup ? letter.origin_text : letter.destination_text
  const point = pickup ? letter.origin_point : letter.destination_point
  const latitude = pickup ? letter.origin_latitude : letter.destination_latitude
  const longitude = pickup ? letter.origin_longitude : letter.destination_longitude
  const address = [point, locality].filter(Boolean).join(', ')
  const destination =
    typeof latitude === 'number' && typeof longitude === 'number'
      ? `${latitude},${longitude}`
      : address
  return {
    label: pickup ? 'Recogida' : 'Entrega',
    address,
    url: `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination })}`,
  }
}

function transportEvent(
  letter: CarriageLetter,
  locations: Array<{ label: string; address: string }>,
): TransportEvent {
  return {
    uid: `${letter.id.replace(/[^a-zA-Z0-9-]+/g, '-')}@kache-envios`,
    date: letter.service_date,
    title: `Transporte Kache Envíos: ${letter.origin_text} → ${letter.destination_text}`,
    description: `${locations.map(({ label, address }) => `${label}: ${address}`).join('\n')}\n${letter.id}\n\nMás adelante recibirás un email con la hora exacta y más detalles.`,
    location: locations.map(({ address }) => address).join(' · '),
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
