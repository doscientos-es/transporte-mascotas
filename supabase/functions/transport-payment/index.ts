import { corsHeaders, json, requireUser, rest } from '../_shared/supabase.ts'

type PreparedPayment = {
  public_token: string
  merchant_order: string
  expires_at: string
  reused_existing_attempt: boolean
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
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
    if (payment.reused_existing_attempt)
      return json(
        {
          error:
            'Hay un intento de pago pendiente de confirmación. No inicies otro pago; actualiza tus transportes o contacta con Kache Envíos para revisar la operación.',
        },
        409,
      )
    const baseUrl = Deno.env.get('SUPABASE_URL')
    return json({
      paymentUrl: `${baseUrl}/functions/v1/payment-redirect?token=${encodeURIComponent(payment.public_token)}&kind=transport`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    if (message === 'No autenticado.') return json({ error: message }, 401)
    console.error('Transport payment preparation failed', { error: message })
    return json(
      {
        error:
          'No hemos podido comprobar si el intento de pago se inició. No vuelvas a pagar todavía; actualiza el estado o contacta con Kache Envíos.',
      },
      503,
    )
  }
})

function isCyberpacConfigured() {
  return Boolean(
    Deno.env.get('CAIXABANK_CYBERPAC_MERCHANT_CODE') &&
    Deno.env.get('CAIXABANK_CYBERPAC_TERMINAL') &&
    Deno.env.get('CAIXABANK_CYBERPAC_SECRET') &&
    Deno.env.get('CAIXABANK_CYBERPAC_ENDPOINT') &&
    Deno.env.get('PUBLIC_APP_URL') &&
    Deno.env.get('SUPABASE_URL'),
  )
}
