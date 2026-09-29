import { supabase } from '@/shared/infrastructure/supabase'

export type AnonymousClientContact = { displayName: string; phone: string }

export async function ensureAnonymousClientSession({ displayName, phone }: AnonymousClientContact) {
  if (!supabase) throw new Error('El acceso no está configurado en este entorno.')

  const current = await supabase.auth.getSession()
  if (current.error) throw new Error('No se ha podido comprobar la sesión. Vuelve a intentarlo.')
  if (current.data.session) return current.data.session

  const response = await supabase.auth.signInAnonymously({
    options: { data: { account_type: 'user', display_name: displayName, phone } },
  })
  if (response.error || !response.data.session) {
    throw new Error(
      'No se ha podido iniciar la solicitud como invitado. Vuelve a intentarlo o accede a tu cuenta.',
    )
  }
  return response.data.session
}

export function validateOptionalClientAccountPassword(password: string, confirmation: string) {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (password !== confirmation) return 'Las contraseñas no coinciden.'
  return ''
}

export async function upgradeAnonymousClientAccount({
  displayName,
  email,
  password,
  phone,
}: AnonymousClientContact & { email: string; password: string }): Promise<
  'created' | 'confirmation_pending'
> {
  if (!supabase) throw new Error('El acceso no está configurado en este entorno.')
  const { data, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !data.session?.user.is_anonymous)
    throw new Error('No se ha podido preparar la cuenta. Puedes continuar como invitado.')

  const emailUpdate = await supabase.auth.updateUser({
    email,
    data: { account_type: 'user', display_name: displayName, phone },
  })
  if (emailUpdate.error) {
    if (/already (registered|been registered|exists)/i.test(emailUpdate.error.message))
      throw new Error('Ya existe una cuenta con ese correo. Puedes continuar como invitado.')
    throw new Error('No se ha podido crear la cuenta. Puedes continuar como invitado.')
  }
  if (!emailUpdate.data.user?.email_confirmed_at) return 'confirmation_pending'

  const passwordUpdate = await supabase.auth.updateUser({ password })
  if (passwordUpdate.error)
    throw new Error('Hemos guardado tu correo, pero no la contraseña. Recupérala desde el acceso.')
  return 'created'
}
