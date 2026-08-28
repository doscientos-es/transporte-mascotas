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

Deno.serve(async (request) => {
  if (request.method !== 'GET') return new Response('Método no permitido.', { status: 405 })
  try {
    const token = new URL(request.url).searchParams.get('token')
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return page('Enlace de pago no válido.', 400)
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
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_MERCHANTURL: `${config.supabaseUrl}/functions/v1/caixabank-webhook`,
      DS_MERCHANT_URLOK: `${config.publicAppUrl}/?payment=ok`,
      DS_MERCHANT_URLKO: `${config.publicAppUrl}/?payment=ko`,
      DS_MERCHANT_PAYMETHODS: 'z',
      DS_MERCHANT_PRODUCTDESCRIPTION: invoice.concept.slice(0, 125),
    })
    const signature = await cyberpacSignature(payment.merchant_order, parameters, config.secret)
    return new Response(form(config.endpoint, parameters, signature), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return page(error instanceof Error ? error.message : 'No se ha podido abrir el pago.', 503)
  }
})

function configuration() {
  const merchantCode = Deno.env.get('CAIXABANK_CYBERPAC_MERCHANT_CODE')
  const terminal = Deno.env.get('CAIXABANK_CYBERPAC_TERMINAL')
  const secret = Deno.env.get('CAIXABANK_CYBERPAC_SECRET')
  const publicAppUrl = Deno.env.get('PUBLIC_APP_URL')?.replace(/\/$/, '')
  const endpoint = Deno.env.get('CAIXABANK_CYBERPAC_ENDPOINT')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '')
  if (!merchantCode || !terminal || !secret || !publicAppUrl || !endpoint || !supabaseUrl)
    throw new Error('Bizum para comercios de CaixaBank todavía no está configurado.')
  return { merchantCode, terminal, secret, publicAppUrl, endpoint, supabaseUrl }
}

function form(endpoint: string, parameters: string, signature: string) {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  return `<!doctype html><html lang="es"><body><p>Abriendo Bizum…</p><form id="payment" action="${escape(endpoint)}" method="post"><input type="hidden" name="Ds_SignatureVersion" value="HMAC_SHA256_V1"><input type="hidden" name="Ds_MerchantParameters" value="${escape(parameters)}"><input type="hidden" name="Ds_Signature" value="${escape(signature)}"></form><script>document.getElementById('payment').submit()</script></body></html>`
}

function page(message: string, status: number) {
  return new Response(
    `<!doctype html><html lang="es"><body><h1>${message}</h1><p>Contacta con el comercio si necesitas ayuda.</p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
