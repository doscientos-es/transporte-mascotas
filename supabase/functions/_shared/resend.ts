export type EmailAttachment = {
  filename: string
  content: Uint8Array | string
  contentType: string
}
export type Email = {
  to: string
  subject: string
  html: string
  text: string
  attachments?: EmailAttachment[]
  /** Resend deduplicates sends with the same key for 24 hours. */
  idempotencyKey?: string
}

export class EmailError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
  }
}

export function isEmailConfigured() {
  return Boolean(Deno.env.get('RESEND_API_KEY') && Deno.env.get('RESEND_FROM_EMAIL'))
}

export async function sendEmail(email: Email) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL')
  if (!apiKey || !from)
    throw new EmailError('El envío de emails todavía no está configurado.', true)
  const replyTo = Deno.env.get('RESEND_REPLY_TO')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(email.idempotencyKey ? { 'Idempotency-Key': email.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(email.attachments?.length
        ? {
            attachments: email.attachments.map((attachment) => ({
              filename: attachment.filename,
              content: toBase64(attachment.content),
              content_type: attachment.contentType,
            })),
          }
        : {}),
    }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    throw new EmailError(
      body?.message?.slice(0, 300) || `Resend ha rechazado el envío (${response.status}).`,
      response.status === 429 || response.status >= 500,
    )
  }
  const result = (await response.json()) as { id?: string }
  if (!result.id) throw new EmailError('Resend no devolvió un identificador de mensaje.', true)
  return result.id
}

export function senderAddress() {
  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? ''
  return (from.match(/<([^>]+)>/)?.[1] ?? from).trim()
}

function toBase64(content: Uint8Array | string) {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
