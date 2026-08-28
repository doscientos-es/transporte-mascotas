import { dispatchBillingNotifications, paymentUrl } from '../_shared/billing-notifications.ts'
import { json, requireAdmin, rest } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok')
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    await requireAdmin(request)
    const { invoiceId, kind } = (await request.json()) as { invoiceId?: string; kind?: string }
    if (
      !invoiceId ||
      !/^[0-9a-f-]{36}$/i.test(invoiceId) ||
      (kind !== 'solicitud_pago' && kind !== 'factura_emitida')
    )
      return json({ error: 'Solicitud no válida.' }, 400)
    const invoiceResponse = await rest(
      `invoice_drafts?id=eq.${encodeURIComponent(invoiceId)}&select=status`,
    )
    const [invoice] = (await invoiceResponse.json()) as Array<{ status: string }>
    if (
      !invoice ||
      (kind === 'solicitud_pago' && invoice.status !== 'solicitud_pago') ||
      (kind === 'factura_emitida' && invoice.status !== 'emitida')
    )
      return json({ error: 'El documento ya no admite este envío.' }, 409)
    if (kind === 'solicitud_pago') requirePaymentConfiguration()
    await rest(
      `billing_notifications?invoice_draft_id=eq.${encodeURIComponent(invoiceId)}&kind=eq.${kind}&status=eq.enviada`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'pendiente', sent_at: null, provider_message_id: null }),
      },
    )
    const link = kind === 'solicitud_pago' ? await paymentUrl(invoiceId) : undefined
    const result = await dispatchBillingNotifications(invoiceId, kind, link)
    if (!result.sent && result.failed)
      return json(
        {
          error:
            'El documento existe, pero no se ha podido entregar. Revisa la configuración del canal.',
        },
        503,
      )
    return json(result)
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'No se ha podido enviar el documento.' },
      500,
    )
  }
})

function requirePaymentConfiguration() {
  const required = [
    'CAIXABANK_CYBERPAC_MERCHANT_CODE',
    'CAIXABANK_CYBERPAC_TERMINAL',
    'CAIXABANK_CYBERPAC_SECRET',
    'CAIXABANK_CYBERPAC_ENDPOINT',
    'PUBLIC_APP_URL',
    'INVOICE_ISSUER_NAME',
    'INVOICE_ISSUER_TAX_ID',
    'INVOICE_ISSUER_ADDRESS',
  ]
  if (required.some((name) => !Deno.env.get(name)))
    throw new Error('Falta configurar CaixaBank o los datos fiscales del emisor.')
}
