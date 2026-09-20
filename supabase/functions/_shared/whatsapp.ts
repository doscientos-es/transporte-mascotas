export type WhatsAppTemplateParameter = { type: 'text'; text: string }

export class WhatsAppError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
  }
}

export async function sendWhatsAppTemplate(
  recipient: string,
  templateEnvironmentVariable: string,
  parameters: WhatsAppTemplateParameter[],
) {
  const template = Deno.env.get(templateEnvironmentVariable)
  if (!template) throw new WhatsAppError('WhatsApp Business todavía no está configurado.', true)
  return postWhatsAppMessage(
    {
      type: 'template',
      template: {
        name: template,
        language: { code: 'es' },
        components: [{ type: 'body', parameters }],
      },
    },
    recipient,
  )
}

/** Free-form message; Meta only delivers it within the 24h customer service window. */
export async function sendWhatsAppText(recipient: string, text: string) {
  return postWhatsAppMessage({ type: 'text', text: { body: text } }, recipient)
}

async function postWhatsAppMessage(message: Record<string, unknown>, recipient: string) {
  const token = Deno.env.get('META_WHATSAPP_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID')
  if (!token || !phoneNumberId)
    throw new WhatsAppError('WhatsApp Business todavía no está configurado.', true)
  const version = Deno.env.get('META_WHATSAPP_GRAPH_API_VERSION') ?? 'v23.0'
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizeWhatsAppPhone(recipient),
      ...message,
    }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: number }
    } | null
    const reason = body?.error?.message?.slice(0, 300)
    throw new WhatsAppError(
      reason || `WhatsApp Business ha rechazado el envío (${response.status}).`,
      response.status === 429 || response.status >= 500,
    )
  }
  const result = (await response.json()) as { messages?: Array<{ id?: string }> }
  const messageId = result.messages?.[0]?.id
  if (!messageId)
    throw new WhatsAppError('WhatsApp Business no devolvió un identificador de mensaje.', true)
  return messageId
}

export function normalizeWhatsAppPhone(value: string) {
  let digits = value.replace(/\D/g, '')
  if (digits.length === 9) digits = `34${digits}`
  if (!/^[1-9][0-9]{7,14}$/.test(digits))
    throw new Error('El teléfono de WhatsApp debe estar en formato internacional.')
  return digits
}

export function isRetryableWhatsAppError(error: unknown) {
  return !(error instanceof WhatsAppError) || error.retryable
}
