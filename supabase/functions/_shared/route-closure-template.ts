import { escapeHtml } from './resend.ts'

export type RouteClosureContent = {
  name: string
  /** Service date already formatted for humans, e.g. "jueves, 2 de octubre". */
  date: string
  routeName: string
  stops: string[]
  portalUrl: string | null
}

const INK = '#1c1c1a'
const CORAL = '#f54245'
const MUTED = '#6b6661'
const CREAM = '#faf6f1'
const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif"

export function routeClosureEmail(content: RouteClosureContent) {
  const greeting = content.name.trim() ? `Hola ${content.name.trim()},` : 'Hola,'
  const subject = `Tu transporte es mañana · ${content.date} · Kache Envíos`
  const intro = `Hemos cerrado el itinerario de la ruta del ${content.date}. Las paradas y los tiempos ya están fijados y mañana realizaremos tu servicio.`
  const note =
    'Te avisaremos con la hora aproximada de recogida o entrega. Ten preparados al animal y su documentación.'
  const closing = 'Si tienes cualquier duda, responde a este email y te ayudaremos.'

  const text = [
    greeting,
    '',
    intro,
    '',
    `RUTA: ${content.routeName}`,
    ...content.stops.map((stop, index) => `${index + 1}. ${stop}`),
    '',
    note,
    ...(content.portalUrl ? ['', `Consulta tus transportes: ${content.portalUrl}`] : []),
    '',
    closing,
    '',
    'Gracias por confiar en Kache Envíos.',
  ].join('\n')

  const stopRows = content.stops
    .map(
      (stop, index) =>
        `<tr><td style="padding:8px 0;${index ? 'border-top:1px solid #ece6df;' : ''}font-size:14px;color:${INK}"><span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:50%;background:${CORAL};color:#ffffff;font-size:12px;font-weight:bold;text-align:center;margin-right:10px">${index + 1}</span>${escapeHtml(stop)}</td></tr>`,
    )
    .join('')
  const button = content.portalUrl
    ? `<tr><td style="padding:18px 32px 6px"><a href="${escapeHtml(content.portalUrl)}" style="display:inline-block;padding:12px 22px;border-radius:8px;font-weight:bold;font-size:14px;text-decoration:none;background:${CORAL};color:#ffffff">Ver mis transportes</a></td></tr>`
    : ''

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${CREAM};font-family:${FONT};color:${INK}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Hemos cerrado la ruta del ${escapeHtml(content.date)}. Tu transporte se realiza mañana.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM}"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:${INK};padding:26px 32px">
<div style="font-size:20px;font-weight:bold;letter-spacing:1px;color:#ffffff">KACHE ENVÍOS</div>
<div style="font-size:12px;color:#d8d3ce;margin-top:4px">Transporte de mascotas</div>
</td></tr>
<tr><td style="padding:32px 32px 8px">
<div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fde8e8;color:${CORAL};font-size:12px;font-weight:bold;letter-spacing:.5px">RUTA CERRADA · TRANSPORTE MAÑANA</div>
<p style="margin:22px 0 8px;font-size:16px">${escapeHtml(greeting)}</p>
<p style="margin:0;font-size:15px;line-height:1.6;color:#3a3835">${escapeHtml(intro)}</p>
</td></tr>
<tr><td style="padding:16px 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:10px"><tr><td style="padding:14px 20px">
<div style="font-size:12px;font-weight:bold;letter-spacing:.5px;color:${MUTED};margin-bottom:6px">${escapeHtml(content.routeName.toUpperCase())}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${stopRows}</table>
</td></tr></table></td></tr>
<tr><td style="padding:8px 32px"><p style="margin:0;font-size:14px;line-height:1.6;color:#3a3835">${escapeHtml(note)}</p></td></tr>
${button}
<tr><td style="padding:16px 32px 32px"><p style="margin:0;font-size:14px;line-height:1.6;color:#3a3835">${escapeHtml(closing)}</p><p style="margin:14px 0 0;font-size:14px;font-weight:bold">Gracias por confiar en Kache Envíos.</p></td></tr>
</table>
<p style="max-width:600px;margin:18px auto 0;font-size:11px;line-height:1.5;color:${MUTED}">Has recibido este email porque tienes un transporte programado con Kache Envíos. Es un mensaje transaccional relacionado con tu servicio.</p>
</td></tr></table>
</body></html>`

  return { subject, text, html }
}
