import { dispatchBillingNotifications } from '../_shared/billing-notifications.ts'
import { persistIssuedInvoiceDocument } from '../_shared/invoice-document.ts'
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
    if (
      !order ||
      !secret ||
      !safeEqual(await cyberpacSignature(order, parameters, secret), signature)
    )
      return new Response('Firma no válida.', { status: 400 })
    const paymentResponse = await rest(
      `invoice_payments?merchant_order=eq.${encodeURIComponent(order)}&select=id,invoice_id,amount_cents,status`,
    )
    const [payment] = (await paymentResponse.json()) as Payment[]
    if (!payment) return new Response('Pedido no encontrado.', { status: 404 })
    if (payment.status === 'pagado') {
      await persistIssuedInvoiceDocument(payment.invoice_id)
      try {
        await dispatchBillingNotifications(payment.invoice_id, 'factura_emitida')
      } catch (error) {
        console.error(
          'Invoice notification deferred',
          error instanceof Error ? error.message : 'unknown error',
        )
      }
      return new Response('OK')
    }
    const amount = Number(notification.Ds_Amount)
    const response = Number(notification.Ds_Response)
    const paid =
      Number.isInteger(response) &&
      response >= 0 &&
      response <= 99 &&
      amount === payment.amount_cents &&
      notification.Ds_Currency === '978'
    const gatewayResponse = {
      response: notification.Ds_Response ?? null,
      authorisationCode: notification.Ds_AuthorisationCode ?? null,
      date: notification.Ds_Date ?? null,
      hour: notification.Ds_Hour ?? null,
    }
    if (!paid) {
      await rest(`invoice_payments?id=eq.${encodeURIComponent(payment.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'fallido', gateway_response: gatewayResponse }),
      })
      return new Response('OK')
    }
    const paidAt = new Date().toISOString()
    await rest('rpc/confirm_invoice_payment', {
      method: 'POST',
      body: JSON.stringify({
        p_payment_id: payment.id,
        p_paid_at: paidAt,
        p_gateway_response: gatewayResponse,
        p_issuer_snapshot: issuerSnapshot(),
      }),
    })
    await persistIssuedInvoiceDocument(payment.invoice_id)
    try {
      await dispatchBillingNotifications(payment.invoice_id, 'factura_emitida')
    } catch (error) {
      console.error(
        'Invoice notification deferred',
        error instanceof Error ? error.message : 'unknown error',
      )
    }
    return new Response('OK')
  } catch (error) {
    console.error(
      'CaixaBank notification rejected',
      error instanceof Error ? error.message : 'unknown error',
    )
    return new Response('Notificación no procesada.', { status: 400 })
  }
})

function issuerSnapshot() {
  const name = Deno.env.get('INVOICE_ISSUER_NAME')
  const taxId = Deno.env.get('INVOICE_ISSUER_TAX_ID')
  const address = Deno.env.get('INVOICE_ISSUER_ADDRESS')
  if (!name || !taxId || !address) throw new Error('Faltan los datos fiscales del emisor.')
  return { name, taxId, address }
}
