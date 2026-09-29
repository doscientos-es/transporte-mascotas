import { escapeHtml } from './resend.ts'

export type Detail = [label: string, value: string]
export type ConfirmationContent = {
  name: string
  invoiceNumber: string | null
  details: Detail[]
  /** Human readable names of the files attached to the email. */
  attachments: string[]
  hasCalendarInvitation: boolean
  portalUrl: string | null
  calendarUrl: string | null
}

const INK = '#1c1c1a'
const CORAL = '#f54245'
const MUTED = '#6b6661'
const CREAM = '#faf6f1'
const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif"

const button = (href: string, label: string, primary: boolean) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 10px 0;padding:12px 22px;border-radius:8px;font-weight:bold;font-size:14px;text-decoration:none;${primary ? `background:${CORAL};color:#ffffff;border:1px solid ${CORAL}` : `background:#ffffff;color:${INK};border:1px solid #dcd7d2`}">${escapeHtml(label)}</a>`

export function paymentConfirmationEmail(content: ConfirmationContent) {
  const greeting = content.name.trim() ? `Hola ${content.name.trim()},` : 'Hola,'
  const subject = content.invoiceNumber
    ? `Pago confirmado · Factura ${content.invoiceNumber} · Kache Envíos`
    : 'Pago confirmado · Kache Envíos'
  const intro =
    'Hemos recibido tu pago correctamente y tu servicio queda confirmado. Te dejamos el resumen de la operación y la documentación.'
  const calendarNote = content.hasCalendarInvitation
    ? 'Incluimos una invitación de calendario con el día del transporte. Te avisaremos con la hora aproximada de recogida.'
    : ''
  const closing = 'Si tienes cualquier duda, responde a este email y te ayudaremos.'

  const text = [
    greeting,
    '',
    intro,
    '',
    'RESUMEN',
    ...content.details.map(([label, value]) => `- ${label}: ${value}`),
    ...(content.attachments.length
      ? ['', 'DOCUMENTOS ADJUNTOS', ...content.attachments.map((name) => `- ${name}`)]
      : []),
    ...(calendarNote ? ['', calendarNote] : []),
    ...(content.calendarUrl ? [`Añadir a Google Calendar: ${content.calendarUrl}`] : []),
    ...(content.portalUrl ? ['', `Consulta tus transportes: ${content.portalUrl}`] : []),
    '',
    closing,
    '',
    'Gracias por confiar en Kache Envíos.',
  ].join('\n')

  const rows = content.details
    .map(
      ([label, value], index) =>
        `<tr><td style="padding:10px 0;${index ? 'border-top:1px solid #ece6df;' : ''}color:${MUTED};font-size:13px;vertical-align:top;width:40%">${escapeHtml(label)}</td><td style="padding:10px 0;${index ? 'border-top:1px solid #ece6df;' : ''}color:${INK};font-size:14px;font-weight:bold;text-align:right">${escapeHtml(value)}</td></tr>`,
    )
    .join('')
  const attachmentList = content.attachments
    .map(
      (name) =>
        `<tr><td style="padding:4px 0;font-size:14px;color:${INK}"><span style="color:${CORAL};font-weight:bold">&#128206;</span>&nbsp; ${escapeHtml(name)}</td></tr>`,
    )
    .join('')
  const buttons = [
    content.portalUrl ? button(content.portalUrl, 'Ver mis transportes', true) : '',
    content.calendarUrl ? button(content.calendarUrl, 'Añadir a Google Calendar', false) : '',
  ].join('')

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${CREAM};font-family:${FONT};color:${INK}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Tu pago se ha confirmado. Adjuntamos la factura y la documentación del servicio.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM}"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:${INK};padding:26px 32px">
<div style="font-size:20px;font-weight:bold;letter-spacing:1px;color:#ffffff">KACHE ENVÍOS</div>
<div style="font-size:12px;color:#d8d3ce;margin-top:4px">Transporte de mascotas</div>
</td></tr>
<tr><td style="padding:32px 32px 8px">
<div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fde8e8;color:${CORAL};font-size:12px;font-weight:bold;letter-spacing:.5px">&#10003; PAGO CONFIRMADO</div>
<p style="margin:22px 0 8px;font-size:16px">${escapeHtml(greeting)}</p>
<p style="margin:0;font-size:15px;line-height:1.6;color:#3a3835">${escapeHtml(intro)}</p>
</td></tr>
<tr><td style="padding:16px 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:10px"><tr><td style="padding:8px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
</td></tr></table></td></tr>
${
  attachmentList
    ? `<tr><td style="padding:8px 32px"><div style="font-size:12px;font-weight:bold;letter-spacing:.5px;color:${MUTED};margin-bottom:6px">DOCUMENTOS ADJUNTOS</div><table role="presentation" cellpadding="0" cellspacing="0">${attachmentList}</table></td></tr>`
    : ''
}
${calendarNote ? `<tr><td style="padding:8px 32px"><p style="margin:0;font-size:14px;line-height:1.6;color:#3a3835">${escapeHtml(calendarNote)}</p></td></tr>` : ''}
${buttons ? `<tr><td style="padding:18px 32px 6px">${buttons}</td></tr>` : ''}
<tr><td style="padding:16px 32px 32px"><p style="margin:0;font-size:14px;line-height:1.6;color:#3a3835">${escapeHtml(closing)}</p><p style="margin:14px 0 0;font-size:14px;font-weight:bold">Gracias por confiar en Kache Envíos.</p></td></tr>
</table>
<p style="max-width:600px;margin:18px auto 0;font-size:11px;line-height:1.5;color:${MUTED}">Has recibido este email porque has realizado un pago a Kache Envíos. Es un mensaje transaccional relacionado con tu servicio.</p>
</td></tr></table>
</body></html>`

  return { subject, text, html }
}
