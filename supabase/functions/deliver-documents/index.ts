// Deploy with Supabase secrets: RESEND_API_KEY, RESEND_FROM,
// WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID. No secret reaches Vite.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const authorization = request.headers.get('Authorization')
  if (!authorization) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { global: { headers: { Authorization: authorization } } })
  const { data: user } = await admin.auth.getUser(authorization.replace('Bearer ', ''))
  const { data: profile } = user.user ? await admin.from('profiles').select('role,active').eq('id', user.user.id).single() : { data: null }
  if (!profile?.active || profile.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403, headers: cors })
  const { deliveryId } = await request.json()
  const { data: delivery, error } = await admin.from('document_deliveries').select('id,channel,recipient,document_kind,letter_id,invoice_id,attempts,carriage_letters(document_path),invoice_drafts(document_path)').eq('id', deliveryId).single()
  if (error || !delivery) return Response.json({ error: 'Delivery not found' }, { status: 404, headers: cors })

  try {
    const path = delivery.document_kind === 'invoice' ? delivery.invoice_drafts?.document_path : delivery.carriage_letters?.document_path
    if (!path) throw new Error('El documento todavía no se ha generado')
    const { data: signed, error: signingError } = await admin.storage.from('operational-documents').createSignedUrl(path, 60 * 60 * 24 * 7)
    if (signingError || !signed?.signedUrl) throw new Error(signingError?.message ?? 'No se pudo crear el enlace privado')
    const text = `${delivery.document_kind === 'invoice' ? 'Tu factura' : 'Tu carta de porte'} de Kache Envíos está disponible durante 7 días: ${signed.signedUrl}`
    if (delivery.channel === 'email') {
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: Deno.env.get('RESEND_FROM'), to: [delivery.recipient], subject: 'Documentación de Kache Envíos', text }) })
      if (!response.ok) throw new Error(await response.text())
    } else {
      const response = await fetch(`https://graph.facebook.com/v22.0/${Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('WHATSAPP_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: delivery.recipient.replace(/\D/g, ''), type: 'text', text: { body: text } }) })
      if (!response.ok) throw new Error(await response.text())
    }
    await admin.from('document_deliveries').update({ status: 'sent', attempts: delivery.attempts + 1, sent_at: new Date().toISOString(), last_error: null }).eq('id', delivery.id)
    return Response.json({ ok: true }, { headers: cors })
  } catch (cause) {
    await admin.from('document_deliveries').update({ status: 'failed', attempts: delivery.attempts + 1, last_error: cause instanceof Error ? cause.message.slice(0, 1000) : 'Unknown delivery error' }).eq('id', delivery.id)
    return Response.json({ error: 'Delivery failed' }, { status: 502, headers: cors })
  }
})
