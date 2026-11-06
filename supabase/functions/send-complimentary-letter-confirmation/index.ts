import { sendComplimentaryLetterConfirmation } from '../_shared/payment-confirmation-email.ts'
import { corsHeaders, json, requireAdmin, rest } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    await requireAdmin(request)
    const body = (await request.json()) as { letterId?: unknown }
    if (typeof body.letterId !== 'string' || !body.letterId.trim())
      return json({ error: 'Carta no válida.' }, 400)
    const response = await rest(
      `carriage_letters?id=eq.${encodeURIComponent(body.letterId)}&select=complimentary,status,entry_source`,
    )
    const [letter] = (await response.json()) as Array<{
      complimentary: boolean
      status: string
      entry_source: string
    }>
    if (
      !letter ||
      !letter.complimentary ||
      letter.entry_source !== 'manual' ||
      letter.status === 'cancelada'
    )
      return json({ error: 'La carta no admite este aviso.' }, 400)
    const sent = await sendComplimentaryLetterConfirmation(body.letterId)
    return json({ sent: sent ?? 0 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se ha podido enviar el aviso.'
    return json({ error: message }, message === 'No autenticado.' ? 401 : 500)
  }
})
