import { json, requireAdmin, rest } from '../_shared/supabase.ts'
import { sendWhatsAppTemplate, type WhatsAppTemplateParameter } from '../_shared/whatsapp.ts'

type Notification = {
  id: string
  daily_route_id: string
  recipient: string
  recipient_name: string
}
type DailyRoute = {
  service_date: string
  route_templates: Array<{ name: string }> | null
  daily_route_stops: Array<{ locality: string; sequence: number }>
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok')
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    await requireAdmin(request)
    const body = (await request.json()) as { routeId?: string }
    const result = await dispatch(body.routeId)
    return json(result)
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'No se han podido enviar los avisos.' },
      500,
    )
  }
})

async function dispatch(routeId?: string) {
  const response = await rest('rpc/claim_daily_route_closure_notifications', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ p_daily_route_id: routeId ?? null }),
  })
  const notifications = (await response.json()) as Notification[]
  let sent = 0
  let failed = 0
  for (const notification of notifications) {
    try {
      const route = await loadRoute(notification.daily_route_id)
      const messageId = await send(notification, route)
      await update(notification.id, {
        status: 'enviada',
        provider_message_id: messageId,
        sent_at: new Date().toISOString(),
        processing_started_at: null,
      })
      sent++
    } catch (error) {
      await update(notification.id, {
        status: 'fallida',
        error_message: safeMessage(error),
        processing_started_at: null,
      })
      failed++
    }
  }
  return { sent, failed }
}

async function loadRoute(routeId: string) {
  const response = await rest(
    `daily_routes?id=eq.${encodeURIComponent(routeId)}&select=service_date,route_templates(name),daily_route_stops(locality,sequence)`,
  )
  const [route] = (await response.json()) as DailyRoute[]
  if (!route) throw new Error('No se ha encontrado la ruta cerrada.')
  return route
}

function send(notification: Notification, route: DailyRoute) {
  const template = 'META_WHATSAPP_DAILY_ROUTE_CLOSURE_TEMPLATE'
  return sendWhatsAppTemplate(
    notification.recipient,
    template,
    messageParameters(notification, route),
  )
}

function messageParameters(
  notification: Notification,
  route: DailyRoute,
): WhatsAppTemplateParameter[] {
  const itinerary = route.daily_route_stops
    .toSorted((left, right) => left.sequence - right.sequence)
    .map((stop) => stop.locality)
    .join(' · ')
  return [
    { type: 'text', text: notification.recipient_name || 'cliente' },
    { type: 'text', text: new Date(`${route.service_date}T12:00:00`).toLocaleDateString('es-ES') },
    { type: 'text', text: `${route.route_templates?.[0]?.name ?? 'Ruta'}: ${itinerary}` },
  ]
}

async function update(notificationId: string, values: Record<string, unknown>) {
  await rest(`daily_route_closure_notifications?id=eq.${encodeURIComponent(notificationId)}`, {
    method: 'PATCH',
    body: JSON.stringify(values),
  })
}

function safeMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : 'Error desconocido al enviar WhatsApp.'
}
