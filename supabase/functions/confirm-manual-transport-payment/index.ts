import { sendTransportPaymentConfirmation } from '../_shared/payment-confirmation-email.ts'
import { corsHeaders, json, requireAdmin, rest } from '../_shared/supabase.ts'

const paymentMethods = new Set(['Transferencia', 'Bizum', 'Efectivo', 'Tarjeta', 'Otro'])

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    const userId = await requireAdmin(request)
    const { requestId, paymentMethod, note } = (await request.json()) as {
      requestId?: string
      paymentMethod?: string
      note?: string
    }
    if (
      !requestId ||
      !/^[0-9a-f-]{36}$/i.test(requestId) ||
      !paymentMethod ||
      !paymentMethods.has(paymentMethod)
    )
      return json({ error: 'Datos de cobro no válidos.' }, 400)

    const statusResponse = await rest(
      `transport_requests?id=eq.${encodeURIComponent(requestId)}&select=status`,
    )
    const [current] = (await statusResponse.json()) as Array<{ status: string }>
    if (!current) return json({ error: 'Solicitud no encontrada.' }, 404)

    // A previous attempt may have recorded the payment but failed to finalize it.
    if (current.status === 'pago_pendiente') {
      await rest('rpc/record_manual_transport_payment', {
        method: 'POST',
        body: JSON.stringify({
          p_request_id: requestId,
          p_payment_method: paymentMethod,
          p_actor_id: userId,
          p_note: (note ?? '').slice(0, 500),
        }),
      })
    } else if (current.status !== 'por_verificar') {
      return json({ error: 'La solicitud no está pendiente de pago.' }, 409)
    }

    const paidAt = new Date().toISOString()
    const finalizeResponse = await rest('rpc/auto_finalize_paid_transport', {
      method: 'POST',
      body: JSON.stringify({
        p_request_id: requestId,
        p_paid_at: paidAt,
        p_gateway_response: { paymentMethod, manualConfirmation: true, registeredAt: paidAt },
        p_issuer_snapshot: issuerSnapshot(),
      }),
    })
    const issuedInvoiceId = (await finalizeResponse.json()) as string | null
    if (!issuedInvoiceId) throw new Error('No se ha podido emitir la factura.')

    try {
      await sendTransportPaymentConfirmation(requestId, issuedInvoiceId)
    } catch (error) {
      console.error(
        'Payment confirmation email not sent',
        error instanceof Error ? error.message : 'unknown error',
      )
    }
    return json({ issuedInvoiceId })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'No se ha podido registrar el cobro.' },
      500,
    )
  }
})

function issuerSnapshot() {
  const name = Deno.env.get('INVOICE_ISSUER_NAME')
  const taxId = Deno.env.get('INVOICE_ISSUER_TAX_ID')
  const address = Deno.env.get('INVOICE_ISSUER_ADDRESS')
  if (!name || !taxId || !address) throw new Error('Faltan los datos fiscales del emisor.')
  return { name, taxId, address }
}
