import { json, requireAdmin, rest } from '../_shared/supabase.ts'
import {
  isRetryableWhatsAppError,
  sendWhatsAppTemplate,
  type WhatsAppTemplateParameter,
} from '../_shared/whatsapp.ts'

type Notification = {
  id: string
  letter_id: string
  kind: 'confirmacion' | 'recordatorio_ruta'
  recipient_role: 'remitente' | 'destinatario'
  recipient: string
  attempts: number
}
type Letter = {
  service_date: string
  sender_name: string
  recipient_name: string
  origin_text: string
  destination_text: string
  origin_point: string
  destination_point: string
  origin_latitude: number | null
  origin_longitude: number | null
  destination_latitude: number | null
  destination_longitude: number | null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok')
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    const body = (await request.json()) as { action?: 'dispatch'; letterId?: string }
    if (!(body.action === 'dispatch' && isCronRequest(request))) await requireAdmin(request)
    if (body.letterId && !body.letterId.startsWith('CARTA DE PORTE Nº'))
      return json({ error: 'Carta no válida.' }, 400)
    return json(await dispatch(body.letterId))
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'No se han podido enviar los avisos.' },
      500,
    )
  }
})

async function dispatch(letterId?: string) {
  const response = await rest('rpc/claim_carriage_letter_notifications', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ p_letter_id: letterId ?? null }),
  })
  const notifications = (await response.json()) as Notification[]
  let sent = 0
  let failed = 0
  for (const notification of notifications) {
    try {
      const letter = await loadLetter(notification.letter_id)
      const messageId = await send(notification, letter)
      await update(notification.id, {
        status: 'enviada',
        provider_message_id: messageId,
        sent_at: new Date().toISOString(),
        processing_started_at: null,
      })
      sent++
    } catch (error) {
      await update(notification.id, failure(notification, error))
      failed++
    }
  }
  return { sent, failed }
}

async function loadLetter(letterId: string) {
  const response = await rest(
    `carriage_letters?id=eq.${encodeURIComponent(letterId)}&select=service_date,sender_name,recipient_name,origin_text,destination_text,origin_point,destination_point,origin_latitude,origin_longitude,destination_latitude,destination_longitude`,
  )
  const [letter] = (await response.json()) as Letter[]
  if (!letter) throw new Error('No se ha encontrado la carta de porte.')
  return letter
}

function send(notification: Notification, letter: Letter) {
  const template =
    notification.kind === 'confirmacion'
      ? 'META_WHATSAPP_TRANSPORT_CONFIRMATION_TEMPLATE'
      : 'META_WHATSAPP_ROUTE_REMINDER_TEMPLATE'
  const name =
    notification.recipient_role === 'remitente' ? letter.sender_name : letter.recipient_name
  return sendWhatsAppTemplate(notification.recipient, template, parameters(name, letter))
}

function parameters(name: string, letter: Letter): WhatsAppTemplateParameter[] {
  return [
    { type: 'text', text: name || 'cliente' },
    { type: 'text', text: formatDate(letter.service_date) },
    { type: 'text', text: letter.origin_text },
    { type: 'text', text: letter.destination_text },
    {
      type: 'text',
      text: mapsLink(letter.origin_latitude, letter.origin_longitude, letter.origin_point),
    },
    {
      type: 'text',
      text: mapsLink(
        letter.destination_latitude,
        letter.destination_longitude,
        letter.destination_point,
      ),
    },
  ]
}

function mapsLink(latitude: number | null, longitude: number | null, fallback: string) {
  return typeof latitude === 'number' && typeof longitude === 'number'
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallback)}`
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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

function isCronRequest(request: Request) {
  const secret = Deno.env.get('CARRIAGE_LETTER_NOTIFICATIONS_CRON_SECRET')
  return Boolean(
    secret && request.headers.get('x-carriage-letter-notifications-cron-secret') === secret,
  )
}

async function update(id: string, values: Record<string, unknown>) {
  await rest(`carriage_letter_notifications?id=eq.${encodeURIComponent(id)}&status=eq.procesando`, {
    method: 'PATCH',
    body: JSON.stringify(values),
  })
}

function safeMessage(error: unknown) {
  return (error instanceof Error ? error.message : 'Error de entrega.').slice(0, 500)
}
