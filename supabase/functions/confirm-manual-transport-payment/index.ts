import { sendTransportPaymentConfirmation } from '../_shared/payment-confirmation-email.ts'
import { corsHeaders, json, requireAdmin, rest, serviceHeaders } from '../_shared/supabase.ts'

const paymentMethods = new Set(['Transferencia', 'Bizum', 'Efectivo', 'Tarjeta', 'Otro'])

/**
 * Error catalogue. Every failure answers `{ error, code, traceId }`, is written to
 * `payment_transaction_events` (event_source = 'admin_manual', error_code, trace_id)
 * and to the function logs as one JSON line. Look an attempt up with:
 *   select * from payment_transaction_events where trace_id = '<traceId>' order by created_at;
 * `action` is what a developer should check first.
 */
const MANUAL_PAYMENT_ERRORS = {
  UNAUTHENTICATED: {
    status: 401,
    outcome: 'ignored',
    message: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
    action: 'The Authorization header is missing or the user token was rejected by auth.',
  },
  FORBIDDEN: {
    status: 403,
    outcome: 'ignored',
    message: 'No tienes permisos para registrar cobros.',
    action: "profiles.role of the caller is not 'admin'.",
  },
  INVALID_INPUT: {
    status: 400,
    outcome: 'ignored',
    message: 'Datos de cobro no válidos.',
    action:
      'Body must be { requestId: uuid, paymentMethod: one of paymentMethods, note?: string }.',
  },
  REQUEST_LOOKUP_FAILED: {
    status: 500,
    outcome: 'retryable_error',
    message: 'No se ha podido consultar la solicitud. Vuelve a intentarlo.',
    action: 'PostgREST read of transport_requests failed; see details.database.',
  },
  REQUEST_NOT_FOUND: {
    status: 404,
    outcome: 'ignored',
    message: 'Solicitud no encontrada.',
    action: 'No transport_requests row has this id.',
  },
  INVALID_STATE: {
    status: 409,
    outcome: 'ignored',
    message: 'La solicitud no está pendiente de pago.',
    action: "Status must be 'pago_pendiente' (new) or 'por_verificar' (retry); see details.status.",
  },
  ISSUER_NOT_CONFIGURED: {
    status: 500,
    outcome: 'retryable_error',
    message: 'Faltan los datos fiscales del emisor. Avisa al equipo técnico.',
    action:
      'Set the INVOICE_ISSUER_NAME, INVOICE_ISSUER_TAX_ID and INVOICE_ISSUER_ADDRESS secrets. Nothing was recorded yet.',
  },
  RECORD_PAYMENT_FAILED: {
    status: 500,
    outcome: 'retryable_error',
    message: 'No se ha podido registrar el cobro. Vuelve a intentarlo.',
    action:
      'rpc record_manual_transport_payment failed; see details.database. The request is still pago_pendiente, so retrying is safe.',
  },
  FINALIZE_FAILED: {
    status: 500,
    outcome: 'retryable_error',
    message:
      'El cobro está registrado, pero no se ha podido completar la solicitud. Pulsa de nuevo para reintentar.',
    action:
      "rpc auto_finalize_paid_transport failed; see details.database. The request stays 'por_verificar' with the payment recorded; retrying resumes at finalization.",
  },
  INVOICE_NOT_ISSUED: {
    status: 500,
    outcome: 'review_required',
    message: 'El cobro está registrado, pero no se ha emitido la factura. Avisa al equipo técnico.',
    action:
      'auto_finalize_paid_transport returned null (request not in a finalizable state). Inspect the request and its letter/invoice rows manually.',
  },
  EMAIL_FAILED: {
    status: 200,
    outcome: 'completed_with_warning',
    message: 'El cobro se ha registrado, pero el email al cliente no se ha podido enviar.',
    action:
      'Resend rejected or could not send the email; see details.database. Resend it manually.',
  },
  EMAIL_NOT_SENT: {
    status: 200,
    outcome: 'completed_with_warning',
    message: 'El cobro se ha registrado, pero el cliente no tiene un email válido.',
    action: 'transport_requests.contact_email is not a valid address.',
  },
  INTERNAL: {
    status: 500,
    outcome: 'retryable_error',
    message: 'Error inesperado al registrar el cobro. Avisa al equipo técnico.',
    action: 'Unhandled exception; see details.technical and the function logs for this traceId.',
  },
} as const
type ErrorCode = keyof typeof MANUAL_PAYMENT_ERRORS
type Stage =
  | 'authorize'
  | 'validate_input'
  | 'load_request'
  | 'read_issuer'
  | 'record_payment'
  | 'finalize_transport'
  | 'send_confirmation_email'
  | 'completed'

class ManualPaymentError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly stage: Stage,
    readonly technical = '',
    readonly extra: Record<string, unknown> = {},
  ) {
    super(MANUAL_PAYMENT_ERRORS[code].message)
  }
}

type Attempt = { traceId: string; actorId: string | null; requestId: string | null }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  const attempt: Attempt = { traceId: crypto.randomUUID(), actorId: null, requestId: null }
  try {
    return await confirmPayment(request, attempt)
  } catch (error) {
    const failure =
      error instanceof ManualPaymentError
        ? error
        : new ManualPaymentError(
            'INTERNAL',
            'completed',
            error instanceof Error ? error.message : String(error),
          )
    await recordEvent(attempt, failure.stage, failure.code, failure.technical, failure.extra)
    console.error(
      JSON.stringify({
        function: 'confirm-manual-transport-payment',
        traceId: attempt.traceId,
        requestId: attempt.requestId,
        actorId: attempt.actorId,
        stage: failure.stage,
        code: failure.code,
        technical: failure.technical,
        ...failure.extra,
      }),
    )
    return json(
      { error: failure.message, code: failure.code, traceId: attempt.traceId },
      MANUAL_PAYMENT_ERRORS[failure.code].status,
    )
  }
})

async function confirmPayment(request: Request, attempt: Attempt) {
  attempt.actorId = await authorize(request)
  const { requestId, paymentMethod, note } = await readInput(request)
  attempt.requestId = requestId
  await recordEvent(attempt, 'validate_input', null, '', { paymentMethod }, 'started')

  const current = await loadRequestStatus(requestId)
  // A previous attempt may have recorded the payment but failed to finalize it.
  const resumed = current === 'por_verificar'
  if (current !== 'pago_pendiente' && !resumed)
    throw new ManualPaymentError('INVALID_STATE', 'load_request', '', { status: current })
  const issuer = issuerSnapshot()

  if (!resumed) {
    await database(
      'rpc/record_manual_transport_payment',
      {
        p_request_id: requestId,
        p_payment_method: paymentMethod,
        p_actor_id: attempt.actorId,
        p_note: (note ?? '').slice(0, 500),
      },
      'RECORD_PAYMENT_FAILED',
      'record_payment',
    )
    await recordEvent(
      attempt,
      'record_payment',
      null,
      '',
      { paymentMethod },
      'confirmation_pending',
    )
  }

  const paidAt = new Date().toISOString()
  const finalizeResponse = await database(
    'rpc/auto_finalize_paid_transport',
    {
      p_request_id: requestId,
      p_paid_at: paidAt,
      p_gateway_response: { paymentMethod, manualConfirmation: true, registeredAt: paidAt },
      p_issuer_snapshot: issuer,
    },
    'FINALIZE_FAILED',
    'finalize_transport',
  )
  const issuedInvoiceId = (await finalizeResponse.json()) as string | null
  if (!issuedInvoiceId) throw new ManualPaymentError('INVOICE_NOT_ISSUED', 'finalize_transport')

  const warning = await sendEmail(attempt, requestId, issuedInvoiceId)
  if (!warning)
    await recordEvent(attempt, 'completed', null, '', { paymentMethod, resumed, issuedInvoiceId })
  return json({
    issuedInvoiceId,
    traceId: attempt.traceId,
    ...(warning ? { warning: warning.message, warningCode: warning.code } : {}),
  })
}

async function authorize(request: Request) {
  try {
    return await requireAdmin(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    throw new ManualPaymentError(
      message.includes('permisos') ? 'FORBIDDEN' : 'UNAUTHENTICATED',
      'authorize',
      message,
    )
  }
}

async function readInput(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    requestId?: string
    paymentMethod?: string
    note?: string
  } | null
  const { requestId, paymentMethod, note } = body ?? {}
  if (
    !requestId ||
    !/^[0-9a-f-]{36}$/i.test(requestId) ||
    !paymentMethod ||
    !paymentMethods.has(paymentMethod)
  )
    throw new ManualPaymentError('INVALID_INPUT', 'validate_input', '', {
      requestId: requestId ?? null,
      paymentMethod: paymentMethod ?? null,
    })
  return { requestId, paymentMethod, note }
}

async function loadRequestStatus(requestId: string) {
  let rows: Array<{ status: string }>
  try {
    const response = await rest(
      `transport_requests?id=eq.${encodeURIComponent(requestId)}&select=status`,
    )
    rows = (await response.json()) as Array<{ status: string }>
  } catch (error) {
    throw new ManualPaymentError(
      'REQUEST_LOOKUP_FAILED',
      'load_request',
      error instanceof Error ? error.message : String(error),
    )
  }
  if (!rows[0]) throw new ManualPaymentError('REQUEST_NOT_FOUND', 'load_request')
  return rows[0].status
}

/** Calls a database function keeping the PostgREST error body, which the shared helper discards. */
async function database(path: string, body: unknown, code: ErrorCode, stage: Stage) {
  const url = Deno.env.get('SUPABASE_URL')
  if (!url) throw new ManualPaymentError(code, stage, 'Falta SUPABASE_URL.')
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify(body),
  }).catch((error: unknown) => {
    throw new ManualPaymentError(code, stage, `fetch failed: ${String(error)}`)
  })
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 1000)
    throw new ManualPaymentError(code, stage, `${path} -> HTTP ${response.status}`, {
      database: detail,
    })
  }
  return response
}

/** The email never undoes the payment: a failure is recorded as a warning. */
async function sendEmail(attempt: Attempt, requestId: string, issuedInvoiceId: string) {
  let failure: ManualPaymentError | null = null
  try {
    const messageId = await sendTransportPaymentConfirmation(requestId, issuedInvoiceId)
    if (!messageId) failure = new ManualPaymentError('EMAIL_NOT_SENT', 'send_confirmation_email')
  } catch (error) {
    failure = new ManualPaymentError(
      'EMAIL_FAILED',
      'send_confirmation_email',
      error instanceof Error ? error.message : String(error),
      { database: error instanceof Error ? error.message : String(error) },
    )
  }
  if (!failure) return null
  await recordEvent(attempt, failure.stage, failure.code, failure.technical, {
    ...failure.extra,
    issuedInvoiceId,
  })
  console.error(
    JSON.stringify({
      function: 'confirm-manual-transport-payment',
      traceId: attempt.traceId,
      requestId,
      stage: failure.stage,
      code: failure.code,
      technical: failure.technical,
    }),
  )
  return failure
}

/** Appends one row to payment_transaction_events; logging problems never block the payment. */
async function recordEvent(
  attempt: Attempt,
  stage: Stage,
  code: ErrorCode | null,
  technical: string,
  details: Record<string, unknown>,
  outcome?: 'started' | 'confirmation_pending',
) {
  if (!attempt.requestId) return
  try {
    const catalogue = code ? MANUAL_PAYMENT_ERRORS[code] : null
    await rest('payment_transaction_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        event_source: 'admin_manual',
        payment_kind: 'transport',
        merchant_order: `manual:${attempt.requestId}`,
        payment_record_id: attempt.requestId,
        processing_stage: stage,
        outcome: catalogue?.outcome ?? outcome ?? 'confirmed',
        error_code: code ?? '',
        error_message: catalogue?.message ?? '',
        trace_id: attempt.traceId,
        actor_id: attempt.actorId,
        processed_at: new Date().toISOString(),
        details: { ...details, ...(technical ? { technical } : {}), action: catalogue?.action },
      }),
    })
  } catch (error) {
    console.error(
      'payment_transaction_events not written',
      error instanceof Error ? error.message : String(error),
    )
  }
}

function issuerSnapshot() {
  const name = Deno.env.get('INVOICE_ISSUER_NAME')
  const taxId = Deno.env.get('INVOICE_ISSUER_TAX_ID')
  const address = Deno.env.get('INVOICE_ISSUER_ADDRESS')
  if (!name || !taxId || !address)
    throw new ManualPaymentError('ISSUER_NOT_CONFIGURED', 'read_issuer')
  return { name, taxId, address }
}
