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
  cyberpacPaymentOutcome,
  cyberpacTransportGatewayResponse,
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
  let paymentEventId: string | null = null
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
    processingStage = 'record_verified_notification'
    paymentEventId = await recordPaymentTransactionEvent({
      eventSource: 'gateway_notification',
      paymentKind: 'unmatched',
      merchantOrder: order,
      amountCents: receivedAmountCents,
      currency: receivedCurrency,
      responseCode: gatewayResponseCode,
      authorisationCode: notification.Ds_AuthorisationCode ?? null,
      gatewayDate: notification.Ds_Date ?? null,
      gatewayHour: notification.Ds_Hour ?? null,
      signatureVerified: true,
      processingStage,
      outcome: 'received',
    })
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
      await updatePaymentTransactionEvent(paymentEventId, {
        paymentKind: 'invoice',
        paymentRecordId: payment.id,
        expectedAmountCents: payment.amount_cents,
        processingStage: 'process_invoice_payment',
      })
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
        await updatePaymentTransactionEvent(paymentEventId, {
          processingStage: 'match_payment_order',
          outcome: 'review_required',
          errorMessage: 'No se encontró una solicitud asociada a la orden firmada.',
        })
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
      await updatePaymentTransactionEvent(paymentEventId, {
        paymentKind: 'transport',
        paymentRecordId: transportPayment.id,
        expectedAmountCents: transportPayment.amount_cents,
        processingStage,
      })
      return await processTransportPayment(transportPayment, notification, order, paymentEventId)
    }
    if (payment.status === 'pagado') {
      processingStage = 'persist_issued_invoice_document'
      await persistIssuedInvoiceDocument(payment.invoice_id)
      await updatePaymentTransactionEvent(paymentEventId, {
        processingStage,
        outcome: 'confirmed',
        processedAt: new Date().toISOString(),
      })
      await recordPaymentAudit('cyberpac_invoice_payment_already_confirmed', entityType, entityId, {
        merchantOrder: order,
        paymentId: payment.id,
      })
      return new Response('OK')
    }
    if (payment.status !== 'pendiente') {
      await updatePaymentTransactionEvent(paymentEventId, {
        processingStage: 'ignore_invoice_payment',
        outcome: 'ignored',
        errorMessage: `El pago ya está en estado ${payment.status}.`,
        processedAt: new Date().toISOString(),
      })
      await recordPaymentAudit('cyberpac_invoice_payment_ignored', entityType, entityId, {
        merchantOrder: order,
        paymentStatus: payment.status,
      })
      return new Response('OK')
    }
    const outcome = cyberpacPaymentOutcome({
      amount: notification.Ds_Amount,
      response: notification.Ds_Response,
      expectedAmount: payment.amount_cents,
      currency: notification.Ds_Currency,
      expectedCurrency: currency,
    })
    const gatewayResponse = {
      response: notification.Ds_Response ?? null,
      authorisationCode: notification.Ds_AuthorisationCode ?? null,
      amountCents: notification.Ds_Amount ?? null,
      date: notification.Ds_Date ?? null,
      hour: notification.Ds_Hour ?? null,
    }
    if (outcome === 'declined') {
      processingStage = 'record_invoice_payment_failure'
      await rest(`invoice_payments?id=eq.${encodeURIComponent(payment.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'fallido', gateway_response: gatewayResponse }),
      })
      await updatePaymentTransactionEvent(paymentEventId, {
        processingStage,
        outcome: 'declined',
        processedAt: new Date().toISOString(),
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
    if (outcome === 'review_required') {
      await updatePaymentTransactionEvent(paymentEventId, {
        processingStage: 'verify_invoice_amount_and_currency',
        outcome: 'review_required',
        errorMessage:
          'La respuesta no permite confirmar con seguridad el importe o la autorización.',
        processedAt: new Date().toISOString(),
      })
      await recordPaymentAudit('cyberpac_invoice_payment_review_required', entityType, entityId, {
        merchantOrder: order,
        responseCode: gatewayResponse.response,
        amountCents: receivedAmountCents,
        expectedAmountCents: payment.amount_cents,
        currency: receivedCurrency,
      })
      return new Response('Operación registrada para revisión.', { status: 200 })
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
    await updatePaymentTransactionEvent(paymentEventId, {
      processingStage: 'invoice_payment_confirmed',
      outcome: 'confirmed',
      processedAt: new Date().toISOString(),
    })
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
    if (paymentEventId) {
      try {
        await updatePaymentTransactionEvent(paymentEventId, {
          processingStage,
          outcome: 'retryable_error',
          errorMessage: message.slice(0, 300),
        })
      } catch (traceError) {
        console.error('Cyberpac transaction event update failed', {
          merchantOrder: merchantOrder || null,
          error: traceError instanceof Error ? traceError.message : 'unknown error',
        })
      }
    }
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
      { status: signatureVerified ? 503 : 400 },
    )
  }
})

async function processTransportPayment(
  payment: TransportPayment,
  notification: Record<string, string>,
  merchantOrder: string,
  paymentEventId: string,
) {
  if (
    payment.status === 'confirmada' ||
    payment.status === 'en_ruta' ||
    payment.status === 'entregada'
  ) {
    await rest(`transport_requests?id=eq.${encodeURIComponent(payment.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ payment_attempt_status: 'confirmed' }),
    })
    await updatePaymentTransactionEvent(paymentEventId, {
      processingStage: 'already_finalized',
      outcome: 'confirmed',
      processedAt: new Date().toISOString(),
    })
    return new Response('OK')
  }
  if (payment.status !== 'pago_pendiente' && payment.status !== 'por_verificar') {
    await updatePaymentTransactionEvent(paymentEventId, {
      processingStage: 'ignore_transport_payment',
      outcome: 'ignored',
      errorMessage: `La solicitud está en estado ${payment.status}.`,
      processedAt: new Date().toISOString(),
    })
    return new Response('OK')
  }
  const gatewayResponse = cyberpacTransportGatewayResponse(notification)
  const outcome = cyberpacPaymentOutcome({
    amount: notification.Ds_Amount,
    response: notification.Ds_Response,
    expectedAmount: payment.amount_cents,
    currency: notification.Ds_Currency,
    expectedCurrency: Deno.env.get('CAIXABANK_CYBERPAC_CURRENCY') || '978',
  })
  if (payment.status === 'pago_pendiente') {
    try {
      const paymentAttemptStatus =
        outcome === 'paid'
          ? 'confirmation_pending'
          : outcome === 'declined'
            ? 'failed'
            : 'review_required'
      await rest(`transport_requests?id=eq.${encodeURIComponent(payment.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(
          outcome === 'paid'
            ? {
                status: 'por_verificar',
                payment_reference: merchantOrder,
                paid_at: new Date().toISOString(),
                payment_gateway_response: gatewayResponse,
                payment_attempt_status: paymentAttemptStatus,
              }
            : {
                payment_reference: merchantOrder,
                payment_gateway_response: gatewayResponse,
                payment_attempt_status: paymentAttemptStatus,
              },
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
  if (outcome === 'paid') {
    await updatePaymentTransactionEvent(paymentEventId, {
      processingStage: 'transport_payment_confirmation_pending',
      outcome: 'confirmation_pending',
    })
  }
  if (outcome === 'declined') {
    await updatePaymentTransactionEvent(paymentEventId, {
      processingStage: 'gateway_declined',
      outcome: 'declined',
      processedAt: new Date().toISOString(),
    })
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
  if (outcome === 'review_required') {
    await updatePaymentTransactionEvent(paymentEventId, {
      processingStage: 'verify_amount_and_currency',
      outcome: 'review_required',
      errorMessage:
        'La pasarela aprobó o no aclaró la operación, pero el importe o la moneda no coinciden.',
      processedAt: new Date().toISOString(),
    })
    await recordPaymentAudit(
      'cyberpac_transport_payment_review_required',
      'transport_request',
      payment.id,
      {
        merchantOrder,
        amountCents: parseGatewayAmount(gatewayResponse.amountCents ?? undefined),
        expectedAmountCents: payment.amount_cents,
        responseCode: gatewayResponse.response,
      },
    )
    return new Response('Operación registrada para revisión.', { status: 200 })
  }

  await recordPaymentAudit('cyberpac_transport_payment_received', 'transport_request', payment.id, {
    merchantOrder,
    amountCents: parseGatewayAmount(gatewayResponse.amountCents ?? undefined),
    responseCode: gatewayResponse.response,
  })
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
    await updatePaymentTransactionEvent(paymentEventId, {
      processingStage: 'finalize_transport_payment',
      outcome: 'retryable_error',
      errorMessage: error instanceof Error ? error.message.slice(0, 300) : 'unknown error',
    })
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
    await updatePaymentTransactionEvent(paymentEventId, {
      processingStage: 'finalize_transport_payment',
      outcome: 'retryable_error',
      errorMessage: 'La finalización no devolvió la factura emitida.',
    })
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
  await rest(`transport_requests?id=eq.${encodeURIComponent(payment.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ payment_attempt_status: 'confirmed' }),
  })
  await updatePaymentTransactionEvent(paymentEventId, {
    processingStage: 'transport_payment_finalized',
    outcome: 'confirmed',
    processedAt: new Date().toISOString(),
  })
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
  try {
    await sendTransportPaymentConfirmation(payment.id, issuedInvoiceId)
  } catch (error) {
    console.error(
      'Payment confirmation email not sent',
      error instanceof Error ? error.message : 'unknown error',
    )
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

type PaymentTransactionEventInput = {
  eventSource: 'checkout_prepared' | 'gateway_notification'
  paymentKind: 'transport' | 'invoice' | 'unmatched'
  merchantOrder: string
  paymentRecordId?: string | null
  amountCents?: number | null
  expectedAmountCents?: number | null
  currency?: string | null
  responseCode?: string | null
  authorisationCode?: string | null
  gatewayDate?: string | null
  gatewayHour?: string | null
  signatureVerified?: boolean
  processingStage: string
  outcome:
    | 'started'
    | 'received'
    | 'confirmation_pending'
    | 'confirmed'
    | 'declined'
    | 'review_required'
    | 'retryable_error'
    | 'ignored'
  errorMessage?: string
  processedAt?: string | null
}

type PaymentTransactionEventUpdate = Partial<
  Pick<
    PaymentTransactionEventInput,
    | 'paymentKind'
    | 'paymentRecordId'
    | 'expectedAmountCents'
    | 'processingStage'
    | 'outcome'
    | 'errorMessage'
    | 'processedAt'
  >
>

async function recordPaymentTransactionEvent(event: PaymentTransactionEventInput) {
  const response = await rest('payment_transaction_events', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      event_source: event.eventSource,
      payment_kind: event.paymentKind,
      merchant_order: event.merchantOrder,
      payment_record_id: event.paymentRecordId ?? null,
      amount_cents: event.amountCents ?? null,
      expected_amount_cents: event.expectedAmountCents ?? null,
      currency: event.currency ?? null,
      response_code: event.responseCode ?? null,
      authorisation_code: event.authorisationCode ?? null,
      gateway_date: event.gatewayDate ?? null,
      gateway_hour: event.gatewayHour ?? null,
      signature_verified: event.signatureVerified ?? false,
      processing_stage: event.processingStage,
      outcome: event.outcome,
      error_message: event.errorMessage ?? '',
      processed_at: event.processedAt ?? null,
    }),
  })
  const [record] = (await response.json()) as Array<{ id: string }>
  if (!record?.id) throw new Error('No se ha podido guardar la traza de la transacción.')
  return record.id
}

async function updatePaymentTransactionEvent(
  eventId: string | null,
  updates: PaymentTransactionEventUpdate,
) {
  if (!eventId) throw new Error('Falta el identificador de la traza de pago.')
  const fields: Record<string, unknown> = {}
  if ('paymentKind' in updates) fields.payment_kind = updates.paymentKind
  if ('paymentRecordId' in updates) fields.payment_record_id = updates.paymentRecordId
  if ('expectedAmountCents' in updates) fields.expected_amount_cents = updates.expectedAmountCents
  if ('processingStage' in updates) fields.processing_stage = updates.processingStage
  if ('outcome' in updates) fields.outcome = updates.outcome
  if ('errorMessage' in updates) fields.error_message = updates.errorMessage
  if ('processedAt' in updates) fields.processed_at = updates.processedAt
  const response = await rest(`payment_transaction_events?id=eq.${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(fields),
  })
  const [record] = (await response.json()) as Array<{ id: string }>
  if (!record?.id) throw new Error('No se ha podido actualizar la traza de la transacción.')
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
