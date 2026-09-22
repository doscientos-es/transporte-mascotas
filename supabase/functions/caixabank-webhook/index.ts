import { dispatchBillingNotifications } from '../_shared/billing-notifications.ts'
import {
  cyberpacSignature,
  decodeMerchantParameters,
  readCyberpacNotification,
  safeEqual,
  type CyberpacSignatureVersion,
} from '../_shared/cyberpac.ts'
import { persistIssuedInvoiceDocument } from '../_shared/invoice-document.ts'
import {
  isSuccessfulCyberpacPayment,
  isValidCyberpacNotification,
} from '../_shared/payment-validation.ts'
import { rest } from '../_shared/supabase.ts'

type Payment = { id: string; invoice_id: string; amount_cents: number; status: string }
type TransportPayment = {
  id: string
  amount_cents: number
  status: string
  payment_merchant_order: string
  daily_route_id: string
  origin_text: string
  destination_text: string
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Método no permitido.', { status: 405 })
  try {
    const { signatureVersion, parameters, signature } = await readCyberpacNotification(request)
    const notification = decodeMerchantParameters(parameters)
    const order = notification.Ds_Order
    const secret = Deno.env.get('CAIXABANK_CYBERPAC_SECRET')
    const merchantCode = Deno.env.get('CAIXABANK_CYBERPAC_MERCHANT_CODE')
    const terminal = Deno.env.get('CAIXABANK_CYBERPAC_TERMINAL')
    const currency = Deno.env.get('CAIXABANK_CYBERPAC_CURRENCY') || '978'
    const expectedSignature = secret
      ? await cyberpacSignature(
          order,
          parameters,
          secret,
          signatureVersion as CyberpacSignatureVersion,
        )
      : ''
    if (
      !isValidCyberpacNotification({
        signatureVersion,
        order,
        secret,
        merchantCode,
        terminal,
        currency,
        notification,
        signature,
        expectedSignature,
      }) ||
      !safeEqual(expectedSignature, signature)
    )
      return new Response('Firma no válida.', { status: 400 })
    const paymentResponse = await rest(
      `invoice_payments?merchant_order=eq.${encodeURIComponent(order)}&select=id,invoice_id,amount_cents,status`,
    )
    const [payment] = (await paymentResponse.json()) as Payment[]
    if (!payment) {
      const transportFields =
        'id,amount_cents,status,payment_merchant_order,daily_route_id,origin_text,destination_text'
      let transportResponse = await rest(
        `transport_requests?payment_merchant_order=eq.${encodeURIComponent(order)}&select=${transportFields}`,
      )
      let [transportPayment] = (await transportResponse.json()) as TransportPayment[]
      if (!transportPayment) {
        transportResponse = await rest(
          `transport_requests?payment_merchant_orders=cs.%7B${encodeURIComponent(order)}%7D&select=${transportFields}`,
        )
        const [historicalPayment] = (await transportResponse.json()) as TransportPayment[]
        transportPayment = historicalPayment
      }
      if (!transportPayment) return new Response('Pedido no encontrado.', { status: 404 })
      return processTransportPayment(transportPayment, notification, order)
    }
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
    if (payment.status !== 'pendiente') return new Response('OK')
    const paid = isSuccessfulCyberpacPayment({
      amount: notification.Ds_Amount,
      response: notification.Ds_Response,
      expectedAmount: payment.amount_cents,
      currency: notification.Ds_Currency,
      expectedCurrency: currency,
    })
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

async function processTransportPayment(
  payment: TransportPayment,
  notification: Record<string, string>,
  merchantOrder: string,
) {
  if (
    payment.status === 'confirmada' ||
    payment.status === 'en_ruta' ||
    payment.status === 'entregada'
  )
    return new Response('OK')
  if (payment.status !== 'pago_pendiente' && payment.status !== 'por_verificar')
    return new Response('OK')
  const gatewayResponse = {
    response: notification.Ds_Response ?? null,
    authorisationCode: notification.Ds_AuthorisationCode ?? null,
    date: notification.Ds_Date ?? null,
    hour: notification.Ds_Hour ?? null,
  }
  const paid = isSuccessfulCyberpacPayment({
    amount: notification.Ds_Amount,
    response: notification.Ds_Response,
    expectedAmount: payment.amount_cents,
    currency: notification.Ds_Currency,
    expectedCurrency: Deno.env.get('CAIXABANK_CYBERPAC_CURRENCY') || '978',
  })
  if (payment.status === 'pago_pendiente')
    await rest(`transport_requests?id=eq.${encodeURIComponent(payment.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(
        paid
          ? {
              status: 'por_verificar',
              payment_reference: merchantOrder,
              paid_at: new Date().toISOString(),
              payment_gateway_response: gatewayResponse,
            }
          : { payment_gateway_response: gatewayResponse },
      ),
    })
  if (paid) {
    try {
      const issuer = issuerSnapshot()
      await rest('rpc/auto_finalize_paid_transport', {
        method: 'POST',
        body: JSON.stringify({
          p_request_id: payment.id,
          p_paid_at: new Date().toISOString(),
          p_gateway_response: gatewayResponse,
          p_issuer_snapshot: issuer,
        }),
      })
    } catch (error) {
      console.error(
        'Transport payment recorded but finalization deferred',
        error instanceof Error ? error.message : 'unknown error',
      )
    }
  }
  return new Response('OK')
}

function issuerSnapshot() {
  const name = Deno.env.get('INVOICE_ISSUER_NAME')
  const taxId = Deno.env.get('INVOICE_ISSUER_TAX_ID')
  const address = Deno.env.get('INVOICE_ISSUER_ADDRESS')
  if (!name || !taxId || !address) throw new Error('Faltan los datos fiscales del emisor.')
  return { name, taxId, address }
}
