import { json, requireUser, rest } from '../_shared/supabase.ts'

type PreparedPayment = {
  public_token: string
  merchant_order: string
  expires_at: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok')
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    const user = await requireUser(request)
    const { requestId } = (await request.json()) as { requestId?: string }
    if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId))
      return json({ error: 'Solicitud no válida.' }, 400)
    if (!isCyberpacConfigured())
      return json({ error: 'La pasarela de CaixaBank todavía no está configurada.' }, 503)

    const response = await rest('rpc/prepare_transport_payment', {
      method: 'POST',
      body: JSON.stringify({ p_request_id: requestId, p_requester_id: user.id }),
    })
    const [payment] = (await response.json()) as PreparedPayment[]
    if (!payment) return json({ error: 'No se ha podido preparar el enlace de pago.' }, 409)
    const baseUrl = Deno.env.get('SUPABASE_URL')
    return json({
      paymentUrl: `${baseUrl}/functions/v1/payment-redirect?token=${encodeURIComponent(payment.public_token)}&kind=transport`,
    })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'No se ha podido preparar el pago.' },
      500,
    )
  }
})

function isCyberpacConfigured() {
  return Boolean(
    Deno.env.get('CAIXABANK_CYBERPAC_MERCHANT_CODE') &&
    Deno.env.get('CAIXABANK_CYBERPAC_TERMINAL') &&
    Deno.env.get('CAIXABANK_CYBERPAC_SECRET') &&
    Deno.env.get('CAIXABANK_CYBERPAC_ENDPOINT') &&
    Deno.env.get('PUBLIC_APP_URL'),
  )
}
