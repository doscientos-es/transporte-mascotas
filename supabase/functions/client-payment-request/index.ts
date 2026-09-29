import { paymentUrl } from '../_shared/billing-notifications.ts'
import { corsHeaders, json, requireUser, rest } from '../_shared/supabase.ts'

type Draft = { id: string; client_snapshot: { email?: string } }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    const user = await requireUser(request)
    const { invoiceId } = (await request.json()) as { invoiceId?: string }
    if (!invoiceId || !/^[0-9a-f-]{36}$/i.test(invoiceId))
      return json({ error: 'Solicitud no válida.' }, 400)
    const response = await rest(
      `invoice_drafts?id=eq.${encodeURIComponent(invoiceId)}&status=eq.solicitud_pago&select=id,client_snapshot`,
    )
    const [draft] = (await response.json()) as Draft[]
    const owner = draft?.client_snapshot.email?.trim().toLowerCase()
    if (!draft || !owner || owner !== user.email?.trim().toLowerCase())
      return json({ error: 'Solicitud de pago no encontrada.' }, 404)
    return json({ paymentUrl: await paymentUrl(draft.id) })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'No se ha podido preparar el pago.' },
      500,
    )
  }
})
