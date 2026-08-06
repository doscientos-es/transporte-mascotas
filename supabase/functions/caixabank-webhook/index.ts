import { cyberpacSignature, decodeMerchantParameters, safeEqual } from '../_shared/cyberpac.ts'
import { rest } from '../_shared/supabase.ts'

type Payment = { id: string; invoice_id: string; amount_cents: number; status: string }

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Método no permitido.', { status: 405 })
  try {
    const body = await request.formData()
    const parameters = String(body.get('Ds_MerchantParameters') ?? '')
    const signature = String(body.get('Ds_Signature') ?? '')
    const notification = decodeMerchantParameters(parameters)
    const order = notification.Ds_Order
    const secret = Deno.env.get('CAIXABANK_CYBERPAC_SECRET')
    if (!order || !secret || !safeEqual(await cyberpacSignature(order, parameters, secret), signature)) return new Response('Firma no válida.', { status: 400 })
    const paymentResponse = await rest(`invoice_payments?merchant_order=eq.${encodeURIComponent(order)}&select=id,invoice_id,amount_cents,status`)
    const [payment] = await paymentResponse.json() as Payment[]
    if (!payment) return new Response('Pedido no encontrado.', { status: 404 })
    if (payment.status === 'pagado') return new Response('OK')
    const amount = Number(notification.Ds_Amount)
    const response = Number(notification.Ds_Response)
    const paid = Number.isInteger(response) && response >= 0 && response <= 99 && amount === payment.amount_cents && notification.Ds_Currency === '978'
    await rest(`invoice_payments?id=eq.${encodeURIComponent(payment.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: paid ? 'pagado' : 'fallido', paid_at: paid ? new Date().toISOString() : null, gateway_response: { response: notification.Ds_Response ?? null, authorisationCode: notification.Ds_AuthorisationCode ?? null, date: notification.Ds_Date ?? null, hour: notification.Ds_Hour ?? null } }),
    })
    if (paid) await rest(`invoice_drafts?id=eq.${encodeURIComponent(payment.invoice_id)}&status=neq.pagada`, { method: 'PATCH', body: JSON.stringify({ status: 'pagada' }) })
    return new Response('OK')
  } catch (error) {
    console.error('CaixaBank notification rejected', error instanceof Error ? error.message : 'unknown error')
    return new Response('Notificación no procesada.', { status: 400 })
  }
})