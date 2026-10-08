import {
  cyberpacSignature,
  decodeMerchantParameters,
  readCyberpacNotification,
  safeEqual,
  type CyberpacSignatureVersion,
} from '../_shared/cyberpac.ts'
import { persistIssuedInvoiceDocument } from '../_shared/invoice-document.ts'
import {
  sendInvoicePaymentConfirmation,
  sendTransportPaymentConfirmation,
} from '../_shared/payment-confirmation-email.ts'
import {
  cyberpacTransportGatewayResponse,
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
  let merchantOrder = ''
  let signatureVerified = false
  let processingStage = 'read_notification'
  let entityType = 'payment'
  let entityId = ''
  let gatewayResponseCode: string | null = null
  let receivedAmountCents: number | null = null
  let receivedCurrency: string | null = null
  try {
    const { signatureVersion, parameters, signature } = await readCyberpacNotification(request)
    const notification = decodeMerchantParameters(parameters)
    const order = notification.Ds_Order
    merchantOrder = order ?? ''
    gatewayResponseCode = notification.Ds_Response ?? null
    receivedAmountCents = parseGatewayAmount(notification.Ds_Amount)
    receivedCurrency = notification.Ds_Currency ?? null
    processingStage = 'verify_signature'
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
    signatureVerified = true
    await recordPaymentAudit('cyberpac_notification_verified', 'payment', order, {
      merchantOrder: order,
      responseCode: gatewayResponseCode,
      amountCents: receivedAmountCents,
      currency: receivedCurrency,
    })
    processingStage = 'find_invoice_payment'
    const paymentResponse = await rest(
      `invoice_payments?merchant_order=eq.${encodeURIComponent(order)}&select=id,invoice_id,amount_cents,status`,
    )
    const [payment] = (await paymentResponse.json()) as Payment[]
    if (payment) {
      entityType = 'invoice_payment'
      entityId = payment.id
    }
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
      if (!transportPayment) {
        await recordPaymentAudit('cyberpac_payment_order_unmatched', 'payment', order, {
          merchantOrder: order,
          responseCode: gatewayResponseCode,
          amountCents: receivedAmountCents,
          currency: receivedCurrency,
        })
        return new Response('Pedido firmado sin pago asociado.', { status: 503 })
      }
      entityType = 'transport_request'
      entityId = transportPayment.id
      processingStage = 'process_transport_payment'
      return await processTransportPayment(transportPayment, notification, order)
    }
    if (payment.status === 'pagado') {
      processingStage = 'persist_issued_invoice_document'
      await persistIssuedInvoiceDocument(payment.invoice_id)
      await recordPaymentAudit('cyberpac_invoice_payment_already_confirmed', entityType, entityId, {
        merchantOrder: order,
        paymentId: payment.id,
      })
      return new Response('OK')
    }
    if (payment.status !== 'pendiente') {
      await recordPaymentAudit('cyberpac_invoice_payment_ignored', entityType, entityId, {
        merchantOrder: order,
        paymentStatus: payment.status,
      })
      return new Response('OK')
    }
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
      processingStage = 'record_invoice_payment_failure'
      await rest(`invoice_payments?id=eq.${encodeURIComponent(payment.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'fallido', gateway_response: gatewayResponse }),
      })
      await recordPaymentAudit('cyberpac_invoice_payment_not_approved', entityType, entityId, {
        merchantOrder: order,
        responseCode: gatewayResponse.response,
        amountCents: receivedAmountCents,
        expectedAmountCents: payment.amount_cents,
        currency: receivedCurrency,
      })
      return new Response('OK')
    }
    const paidAt = new Date().toISOString()
    processingStage = 'confirm_invoice_payment'
    const issuedResponse = await rest('rpc/confirm_invoice_payment', {
      method: 'POST',
      body: JSON.stringify({
        p_payment_id: payment.id,
        p_paid_at: paidAt,
        p_gateway_response: gatewayResponse,
        p_issuer_snapshot: issuerSnapshot(),
      }),
    })
    const issuedInvoiceId = (await issuedResponse.json()) as string
    processingStage = 'persist_issued_invoice_document'
    await persistIssuedInvoiceDocument(payment.invoice_id)
    await recordPaymentAudit('cyberpac_invoice_payment_confirmed', entityType, entityId, {
      merchantOrder: order,
      paymentId: payment.id,
      issuedInvoiceId,
      amountCents: receivedAmountCents,
    })
    try {
      await sendInvoicePaymentConfirmation(payment.invoice_id, issuedInvoiceId)
    } catch (error) {
      console.error(
        'Payment confirmation email not sent',
        error instanceof Error ? error.message : 'unknown error',
      )
    }
    return new Response('OK')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.error('CaixaBank notification processing failed', {
      merchantOrder: merchantOrder || null,
      entityType,
      entityId: entityId || null,
      stage: processingStage,
      responseCode: gatewayResponseCode,
      amountCents: receivedAmountCents,
      currency: receivedCurrency,
      error: message,
    })
    if (signatureVerified && merchantOrder) {
      await recordPaymentAudit(
        'cyberpac_webhook_processing_failed',
        entityType,
        entityId || merchantOrder,
        {
          merchantOrder,
          stage: processingStage,
          responseCode: gatewayResponseCode,
          amountCents: receivedAmountCents,
          currency: receivedCurrency,
          error: message.slice(0, 300),
        },
      )
    }
    return new Response(
      signatureVerified
        ? 'Notificación verificada pendiente de reintento.'
        : 'Notificación no procesada.',
      { status: signatureVerified ? 500 : 400 },
    )
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
  const gatewayResponse = cyberpacTransportGatewayResponse(notification)
  const paid = isSuccessfulCyberpacPayment({
    amount: notification.Ds_Amount,
    response: notification.Ds_Response,
    expectedAmount: payment.amount_cents,
    currency: notification.Ds_Currency,
    expectedCurrency: Deno.env.get('CAIXABANK_CYBERPAC_CURRENCY') || '978',
  })
  if (payment.status === 'pago_pendiente') {
    try {
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
    } catch (error) {
      await recordPaymentAudit(
        'cyberpac_transport_payment_write_failed',
        'transport_request',
        payment.id,
        {
          merchantOrder,
          responseCode: gatewayResponse.response,
          amountCents: parseGatewayAmount(gatewayResponse.amountCents ?? undefined),
          expectedAmountCents: payment.amount_cents,
          currency: notification.Ds_Currency ?? null,
          stage: 'record_paid_state',
        },
      )
      console.error('Cyberpac transport payment state write failed', {
        requestId: payment.id,
        merchantOrder,
        stage: 'record_paid_state',
        error: error instanceof Error ? error.message : 'unknown error',
      })
      throw error
    }
  }
  if (!paid) {
    await recordPaymentAudit(
      'cyberpac_transport_payment_not_approved',
      'transport_request',
      payment.id,
      {
        merchantOrder,
        responseCode: gatewayResponse.response,
        amountCents: parseGatewayAmount(gatewayResponse.amountCents ?? undefined),
        expectedAmountCents: payment.amount_cents,
        currency: notification.Ds_Currency ?? null,
      },
    )
    return new Response('OK')
  }
  await recordPaymentAudit('cyberpac_transport_payment_received', 'transport_request', payment.id, {
    merchantOrder,
    amountCents: parseGatewayAmount(gatewayResponse.amountCents ?? undefined),
    responseCode: gatewayResponse.response,
  })
  if (paid) {
    let issuedInvoiceId: string | null = null
    try {
      const issuer = issuerSnapshot()
      const finalizeResponse = await rest('rpc/auto_finalize_paid_transport', {
        method: 'POST',
        body: JSON.stringify({
          p_request_id: payment.id,
          p_paid_at: new Date().toISOString(),
          p_gateway_response: gatewayResponse,
          p_issuer_snapshot: issuer,
        }),
      })
      issuedInvoiceId = (await finalizeResponse.json()) as string | null
    } catch (error) {
      await recordPaymentAudit(
        'cyberpac_transport_finalization_deferred',
        'transport_request',
        payment.id,
        { merchantOrder, amountCents: payment.amount_cents, stage: 'finalize_transport_payment' },
      )
      console.error('Transport payment recorded but finalization deferred', {
        requestId: payment.id,
        merchantOrder,
        error: error instanceof Error ? error.message : 'unknown error',
      })
      return new Response('Pago registrado; la confirmación operativa se reintentará.', {
        status: 503,
      })
    }
    if (!issuedInvoiceId) {
      await recordPaymentAudit(
        'cyberpac_transport_finalization_deferred',
        'transport_request',
        payment.id,
        {
          merchantOrder,
          amountCents: payment.amount_cents,
          stage: 'finalize_transport_payment_no_invoice',
        },
      )
      return new Response('Pago registrado; la confirmación operativa se reintentará.', {
        status: 503,
      })
    }
    await recordPaymentAudit(
      'cyberpac_transport_payment_finalized',
      'transport_request',
      payment.id,
      {
        merchantOrder,
        amountCents: payment.amount_cents,
        issuedInvoiceId,
      },
    )
    if (issuedInvoiceId) {
      try {
        await sendTransportPaymentConfirmation(payment.id, issuedInvoiceId)
      } catch (error) {
        console.error(
          'Payment confirmation email not sent',
          error instanceof Error ? error.message : 'unknown error',
        )
      }
    }
  }
  return new Response('OK')
}

async function recordPaymentAudit(
  eventType: string,
  entityType: string,
  entityId: string,
  data: Record<string, unknown>,
) {
  try {
    await rest('audit_logs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        data,
      }),
    })
  } catch (error) {
    console.error('Cyberpac payment audit write failed', {
      eventType,
      entityType,
      entityId,
      error: error instanceof Error ? error.message : 'unknown error',
    })
  }
}

function parseGatewayAmount(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return null
  const amount = Number(value)
  return Number.isSafeInteger(amount) ? amount : null
}

function issuerSnapshot() {
  const name = Deno.env.get('INVOICE_ISSUER_NAME')
  const taxId = Deno.env.get('INVOICE_ISSUER_TAX_ID')
  const address = Deno.env.get('INVOICE_ISSUER_ADDRESS')
  if (!name || !taxId || !address) throw new Error('Faltan los datos fiscales del emisor.')
  return { name, taxId, address }
}
