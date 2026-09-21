import { cyberpacSignature, encodeMerchantParameters } from '../_shared/cyberpac.ts'
import { rest } from '../_shared/supabase.ts'

type Payment = {
  merchant_order: string
  amount_cents: number
  status: string
  expires_at: string
  invoice_id: string
}
type Invoice = { status: string; concept: string }
type TransportRequest = {
  payment_merchant_order: string
  amount_cents: number
  status: string
  payment_expires_at: string
}

Deno.serve(async (request) => {
  if (request.method !== 'GET') return new Response('Método no permitido.', { status: 405 })
  try {
    const token = new URL(request.url).searchParams.get('token')
    const kind = new URL(request.url).searchParams.get('kind')
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return page('Enlace de pago no válido.', 400)
    if (kind === 'transport') return transportPaymentPage(token)
    const paymentResponse = await rest(
      `invoice_payments?public_token=eq.${encodeURIComponent(token)}&select=merchant_order,amount_cents,status,expires_at,invoice_id`,
    )
    const [payment] = (await paymentResponse.json()) as Payment[]
    if (!payment || payment.status !== 'pendiente' || new Date(payment.expires_at) <= new Date())
      return page('Este enlace de pago ya no está disponible.', 410)
    const invoiceResponse = await rest(
      `invoice_drafts?id=eq.${encodeURIComponent(payment.invoice_id)}&select=status,concept`,
    )
    const [invoice] = (await invoiceResponse.json()) as Invoice[]
    if (!invoice || invoice.status !== 'solicitud_pago')
      return page('Esta solicitud de pago ya no está disponible.', 409)
    const config = configuration()
    const parameters = encodeMerchantParameters({
      DS_MERCHANT_AMOUNT: String(payment.amount_cents),
      DS_MERCHANT_ORDER: payment.merchant_order,
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_CURRENCY: config.currency,
      DS_MERCHANT_TRANSACTIONTYPE: config.transactionType,
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_MERCHANTURL: `${config.supabaseUrl}/functions/v1/caixabank-webhook`,
      DS_MERCHANT_URLOK: `${config.publicAppUrl}/?payment=ok`,
      DS_MERCHANT_URLKO: `${config.publicAppUrl}/?payment=ko`,
      DS_MERCHANT_PRODUCTDESCRIPTION: invoice.concept.slice(0, 125),
      ...(config.payMethods ? { DS_MERCHANT_PAYMETHODS: config.payMethods } : {}),
    })
    const signature = await cyberpacSignature(payment.merchant_order, parameters, config.secret)
    return htmlResponse(form(config.endpoint, config.signatureVersion, parameters, signature))
  } catch (error) {
    console.error(
      'Cyberpac payment redirect failed',
      error instanceof Error ? error.message : error,
    )
    return page('No se ha podido abrir el pago.', 503)
  }
})

async function transportPaymentPage(token: string) {
  const response = await rest(
    `transport_requests?payment_public_token=eq.${encodeURIComponent(token)}&select=payment_merchant_order,amount_cents,status,payment_expires_at`,
  )
  const [payment] = (await response.json()) as TransportRequest[]
  if (
    !payment ||
    payment.status !== 'pago_pendiente' ||
    !payment.payment_merchant_order ||
    new Date(payment.payment_expires_at) <= new Date()
  )
    return page('Este enlace de pago ya no está disponible.', 410)
  const config = configuration()
  const parameters = encodeMerchantParameters({
    DS_MERCHANT_AMOUNT: String(payment.amount_cents),
    DS_MERCHANT_ORDER: payment.payment_merchant_order,
    DS_MERCHANT_MERCHANTCODE: config.merchantCode,
    DS_MERCHANT_CURRENCY: config.currency,
    DS_MERCHANT_TRANSACTIONTYPE: config.transactionType,
    DS_MERCHANT_TERMINAL: config.terminal,
    DS_MERCHANT_MERCHANTURL: `${config.supabaseUrl}/functions/v1/caixabank-webhook`,
    DS_MERCHANT_URLOK: `${config.publicAppUrl}/?payment=ok`,
    DS_MERCHANT_URLKO: `${config.publicAppUrl}/?payment=ko`,
    DS_MERCHANT_PRODUCTDESCRIPTION: 'Transporte de mascotas',
    ...(config.payMethods ? { DS_MERCHANT_PAYMETHODS: config.payMethods } : {}),
  })
  const signature = await cyberpacSignature(
    payment.payment_merchant_order,
    parameters,
    config.secret,
  )
  return htmlResponse(form(config.endpoint, config.signatureVersion, parameters, signature))
}

function configuration() {
  const merchantCode = Deno.env.get('CAIXABANK_CYBERPAC_MERCHANT_CODE')
  const terminal = Deno.env.get('CAIXABANK_CYBERPAC_TERMINAL')
  const secret = Deno.env.get('CAIXABANK_CYBERPAC_SECRET')
  const publicAppUrl = Deno.env.get('PUBLIC_APP_URL')?.replace(/\/$/, '')
  const endpoint = Deno.env.get('CAIXABANK_CYBERPAC_ENDPOINT')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '')
  const currency = Deno.env.get('CAIXABANK_CYBERPAC_CURRENCY') || '978'
  const transactionType = Deno.env.get('CAIXABANK_CYBERPAC_TRANSACTION_TYPE') || '0'
  const signatureVersion = Deno.env.get('CAIXABANK_CYBERPAC_SIGNATURE_VERSION') || 'HMAC_SHA256_V1'
  const payMethods = Deno.env.get('CAIXABANK_CYBERPAC_PAYMETHODS')?.trim()
  if (!merchantCode || !terminal || !secret || !publicAppUrl || !endpoint || !supabaseUrl)
    throw new Error('La pasarela de CaixaBank todavía no está configurada.')
  if (signatureVersion !== 'HMAC_SHA256_V1')
    throw new Error('La versión de firma Cyberpac debe ser HMAC_SHA256_V1.')
  return {
    merchantCode,
    terminal,
    secret,
    publicAppUrl,
    endpoint,
    supabaseUrl,
    currency,
    transactionType,
    signatureVersion,
    payMethods,
  }
}

function form(endpoint: string, signatureVersion: string, parameters: string, signature: string) {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Pago seguro</title></head><body><p>Abriendo la pasarela de pago…</p><form id="payment" action="${escape(endpoint)}" method="post"><input type="hidden" name="Ds_SignatureVersion" value="${escape(signatureVersion)}"><input type="hidden" name="Ds_MerchantParameters" value="${escape(parameters)}"><input type="hidden" name="Ds_Signature" value="${escape(signature)}"><button type="submit">Continuar al pago</button></form><script>document.getElementById('payment').submit()</script></body></html>`
}

function page(message: string, status: number) {
  return htmlResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Error de pago</title></head><body><h1>${message}</h1><p>Contacta con el comercio si necesitas ayuda.</p></body></html>`,
    status,
  )
}

function htmlResponse(body: string, status = 200) {
  return new Response(new TextEncoder().encode(body), {
    status,
    headers: new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    }),
  })
}
