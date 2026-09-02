import { json, requireAdmin, rest } from '../_shared/supabase.ts'
import { sendWhatsAppTemplate, type WhatsAppTemplateParameter } from '../_shared/whatsapp.ts'

type NotificationKind = 'confirmacion' | 'recordatorio_ruta'
type Notification = { id: string; request_id: string; kind: NotificationKind; recipient: string }
type TransportRequest = {
  id: string
  contact_name: string
  origin_text: string
  destination_text: string
  origin_latitude: number | null
  origin_longitude: number | null
  destination_latitude: number | null
  destination_longitude: number | null
  desired_date: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok')
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    const body = (await request.json()) as {
      action?: 'dispatch' | 'test'
      requestId?: string
      kind?: NotificationKind
      phone?: string
    }
    if (!(body.action === 'dispatch' && isCronRequest(request))) await requireAdmin(request)
    if (body.action === 'test') return await sendTest(body.phone, body.kind)
    if (body.requestId && !isUuid(body.requestId))
      return json({ error: 'Solicitud no válida.' }, 400)
    const result = await dispatch(body.requestId)
    return json(result)
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'No se han podido enviar los avisos.' },
      500,
    )
  }
})

async function sendTest(phone?: string, kind?: NotificationKind) {
  if (!phone || (kind !== 'confirmacion' && kind !== 'recordatorio_ruta'))
    return json({ error: 'Indica un teléfono y el mensaje de prueba.' }, 400)
  const messageId = await send(kind, phone, {
    id: 'test',
    contact_name: 'Cliente de prueba',
    origin_text: 'Madrid',
    destination_text: 'Valencia',
    origin_latitude: 40.4168,
    origin_longitude: -3.7038,
    destination_latitude: 39.4699,
    destination_longitude: -0.3763,
    desired_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  })
  return json({ sent: 1, messageId })
}

async function dispatch(requestId?: string) {
  const response = await rest('rpc/claim_transport_request_notifications', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ p_request_id: requestId ?? null }),
  })
  const notifications = (await response.json()) as Notification[]
  let sent = 0
  let failed = 0
  for (const notification of notifications) {
    try {
      const transportRequest = await loadRequest(notification.request_id)
      const messageId = await send(notification.kind, notification.recipient, transportRequest)
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

async function loadRequest(requestId: string) {
  const response = await rest(
    `transport_requests?id=eq.${encodeURIComponent(requestId)}&select=id,contact_name,origin_text,destination_text,desired_date,origin_latitude,origin_longitude,destination_latitude,destination_longitude`,
  )
  const [transportRequest] = (await response.json()) as TransportRequest[]
  if (!transportRequest) throw new Error('No se ha encontrado la solicitud de transporte.')
  return transportRequest
}

async function send(kind: NotificationKind, phone: string, transportRequest: TransportRequest) {
  const template =
    kind === 'confirmacion'
      ? 'META_WHATSAPP_TRANSPORT_CONFIRMATION_TEMPLATE'
      : 'META_WHATSAPP_ROUTE_REMINDER_TEMPLATE'
  return sendWhatsAppTemplate(phone, template, messageParameters(transportRequest))
}

function messageParameters(request: TransportRequest): WhatsAppTemplateParameter[] {
  return [
    { type: 'text', text: request.contact_name },
    { type: 'text', text: formatDate(request.desired_date) },
    { type: 'text', text: request.origin_text },
    { type: 'text', text: request.destination_text },
    {
      type: 'text',
      text: mapsLink(request.origin_latitude, request.origin_longitude, request.origin_text),
    },
    {
      type: 'text',
      text: mapsLink(
        request.destination_latitude,
        request.destination_longitude,
        request.destination_text,
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

function isUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value)
}

function isCronRequest(request: Request) {
  const secret = Deno.env.get('TRANSPORT_NOTIFICATIONS_CRON_SECRET')
  return Boolean(secret && request.headers.get('x-transport-notifications-cron-secret') === secret)
}

async function updateNotification(id: string, body: Record<string, unknown>) {
  await rest(`transport_request_notifications?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

function safeMessage(error: unknown) {
  return (error instanceof Error ? error.message : 'Error de entrega.').slice(0, 500)
}
