import { sendWhatsAppText } from '../_shared/whatsapp.ts'

// Meta calls this endpoint with the events of the notices number: a GET to
// validate the subscription and a POST signed with the app secret for every
// notification. Whoever writes to the notices number gets an auto-reply that
// redirects them to the transporter's main phone, so the transporter can keep
// chatting from the regular WhatsApp Business app.

const encoder = new TextEncoder()

type WebhookMessage = { from?: string; type?: string }
type WebhookChange = {
  value?: { metadata?: { phone_number_id?: string }; messages?: WebhookMessage[] }
}
type WebhookPayload = { entry?: Array<{ changes?: WebhookChange[] }> }

Deno.serve(async (request) => {
  if (request.method === 'GET') return verifySubscription(request)
  if (request.method !== 'POST') return new Response('Método no permitido.', { status: 405 })
  try {
    const rawBody = await request.text()
    if (!(await validSignature(request, rawBody)))
      return new Response('Firma no válida.', { status: 401 })
    await answerInboundMessages(JSON.parse(rawBody) as WebhookPayload)
    return new Response('OK')
  } catch (error) {
    // Always answer 2xx for signed traffic: Meta deactivates webhooks that fail.
    console.error(
      'WhatsApp notification rejected',
      error instanceof Error ? error.message : 'unknown error',
    )
    return new Response('OK')
  }
})

function verifySubscription(request: Request) {
  const url = new URL(request.url)
  const expected = Deno.env.get('META_WHATSAPP_VERIFY_TOKEN')
  const challenge = url.searchParams.get('hub.challenge')
  const valid =
    url.searchParams.get('hub.mode') === 'subscribe' &&
    Boolean(expected) &&
    Boolean(challenge) &&
    secureEqual(url.searchParams.get('hub.verify_token') ?? '', expected ?? '')
  if (!valid) return new Response('Verificación no válida.', { status: 403 })
  return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

async function validSignature(request: Request, rawBody: string) {
  const header = request.headers.get('x-hub-signature-256') ?? ''
  const appSecret = Deno.env.get('META_WHATSAPP_APP_SECRET')
  if (!appSecret || !header.startsWith('sha256=')) return false
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody)))
  const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return secureEqual(header.slice('sha256='.length), expected)
}

async function answerInboundMessages(payload: WebhookPayload) {
  const reply = Deno.env.get('META_WHATSAPP_AUTOREPLY_TEXT')
  const phoneNumberId = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID')
  if (!reply || !phoneNumberId) return
  const values = payload.entry
    ?.flatMap((entry) => entry.changes ?? [])
    .map((change) => change.value)
  for (const value of values ?? []) {
    // `messages` only arrives for inbound traffic; delivery receipts are skipped.
    if (!value?.messages?.length) continue
    if (value.metadata?.phone_number_id !== phoneNumberId) continue
    for (const message of value.messages) {
      if (!message.from || UNSUPPORTED_KINDS.has(message.type ?? '')) continue
      try {
        await sendWhatsAppText(message.from, reply)
      } catch (error) {
        console.error(
          'Autorespuesta fallida',
          error instanceof Error ? error.message : 'unknown error',
        )
      }
    }
  }
}

const UNSUPPORTED_KINDS = new Set(['system', 'reaction', 'unsupported'])

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index++)
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return result === 0
}
