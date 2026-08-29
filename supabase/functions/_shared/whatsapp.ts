export type WhatsAppTemplateParameter = { type: 'text'; text: string }

export async function sendWhatsAppTemplate(
  recipient: string,
  templateEnvironmentVariable: string,
  parameters: WhatsAppTemplateParameter[],
) {
  const token = Deno.env.get('META_WHATSAPP_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID')
  const template = Deno.env.get(templateEnvironmentVariable)
  if (!token || !phoneNumberId || !template)
    throw new Error('WhatsApp Business todavía no está configurado.')
  const version = Deno.env.get('META_WHATSAPP_GRAPH_API_VERSION') ?? 'v23.0'
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizeWhatsAppPhone(recipient),
      type: 'template',
      template: {
        name: template,
        language: { code: 'es' },
        components: [{ type: 'body', parameters }],
      },
    }),
  })
  if (!response.ok) throw new Error(`WhatsApp Business ha rechazado el envío (${response.status}).`)
  const result = (await response.json()) as { messages?: Array<{ id?: string }> }
  return result.messages?.[0]?.id ?? ''
}

export function normalizeWhatsAppPhone(value: string) {
  let digits = value.replace(/\D/g, '')
  if (digits.length === 9) digits = `34${digits}`
  if (!/^[1-9][0-9]{7,14}$/.test(digits))
    throw new Error('El teléfono de WhatsApp debe estar en formato internacional.')
  return digits
}
