import { isEmailConfigured, isValidEmail, sendEmail } from '../_shared/resend.ts'
import { json, requireAdminUser } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok')
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    const user = await requireAdminUser(request)
    const email = user.email?.trim()
    if (!isValidEmail(email))
      return json({ error: 'La cuenta administradora no tiene un email válido.' }, 400)
    if (!isEmailConfigured()) return json({ error: 'El envío de emails no está configurado.' }, 503)

    await sendEmail({
      to: email,
      subject: 'Prueba de email · Kache Envíos',
      html: '<p>Este es un email de prueba enviado desde Ajustes de Kache Envíos.</p><p>La configuración compartida funciona correctamente.</p>',
      text: 'Este es un email de prueba enviado desde Ajustes de Kache Envíos.\nLa configuración compartida funciona correctamente.',
      idempotencyKey: `email-test/${user.id}/${crypto.randomUUID()}`,
    })
    return json({ sent: true, email })
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'No se ha podido enviar el email.' },
      500,
    )
  }
})
