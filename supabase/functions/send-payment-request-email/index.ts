import { paymentUrl } from '../_shared/billing-notifications.ts'
import { escapeHtml, isEmailConfigured, isValidEmail, sendEmail } from '../_shared/resend.ts'
import { corsHeaders, json, requireAdmin, rest } from '../_shared/supabase.ts'

type Draft = {
  id: string
  concept: string
  total_amount: string
  client_snapshot: { fullName?: string; email?: string }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    await requireAdmin(request)
    const { letterId } = (await request.json()) as { letterId?: string }
    if (!letterId) return json({ error: 'Carta no válida.' }, 400)
    const response = await rest(
      `invoice_drafts?letter_id=eq.${encodeURIComponent(letterId)}&status=eq.solicitud_pago&select=id,concept,total_amount,client_snapshot`,
    )
    const [draft] = (await response.json()) as Draft[]
    if (!draft) return json({ error: 'La solicitud de pago ya no está disponible.' }, 409)
    const email = draft.client_snapshot.email?.trim()
    if (!isValidEmail(email)) return json({ sent: false, reason: 'sin_email' })
    if (!isEmailConfigured()) return json({ error: 'El envío de emails no está configurado.' }, 503)

    const link = await paymentUrl(draft.id)
    const name = escapeHtml(draft.client_snapshot.fullName?.trim() || 'cliente')
    const total = `${Number(draft.total_amount).toFixed(2).replace('.', ',')} €`
    const concept = escapeHtml(draft.concept)
    const appUrl = Deno.env.get('PUBLIC_APP_URL')?.replace(/\/$/, '')
    await sendEmail({
      to: email,
      subject: 'Tu solicitud de pago de Kache Envíos',
      html: `<p>Hola ${name},</p><p>Tienes una solicitud de pago pendiente: <strong>${concept}</strong> por <strong>${total}</strong>.</p><p><a href="${escapeHtml(link)}">Pagar ahora</a></p>${appUrl ? `<p>También la encontrarás en tu cuenta: <a href="${escapeHtml(appUrl)}/mis-transportes">Mis transportes</a>.</p>` : ''}`,
      text: `Hola ${draft.client_snapshot.fullName?.trim() || 'cliente'},\n\nTienes una solicitud de pago pendiente: ${draft.concept} por ${total}.\nPagar ahora: ${link}${appUrl ? `\nTambién la encontrarás en tu cuenta: ${appUrl}/mis-transportes` : ''}`,
      idempotencyKey: `payment-request/${draft.id}`,
    })
    return json({ sent: true })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'No se ha podido enviar el email.' },
      500,
    )
  }
})
