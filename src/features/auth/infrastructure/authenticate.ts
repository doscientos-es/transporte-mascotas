import { AUTH_PATHS } from '@/shared/constants/auth-paths'
import { supabase } from '@/shared/infrastructure/supabase'

type AuthenticationInput = {
  displayName: string
  email: string
  mode: 'login' | 'signup'
  password: string
  phone: string
}

type PasswordRecoveryInput = {
  email: string
}

function getAuthRedirectUrl(path: string) {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

export async function authenticate({
  displayName,
  email,
  mode,
  password,
  phone,
}: AuthenticationInput) {
  if (!supabase) return { unavailable: true, error: null, hasSession: false }
  const response =
    mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(AUTH_PATHS.clientAccess),
            data: { display_name: displayName, phone, account_type: 'user' },
          },
        })
  return { unavailable: false, error: response.error, hasSession: Boolean(response.data.session) }
}

export async function resendConfirmation({ email }: PasswordRecoveryInput) {
  if (!supabase) return { unavailable: true, error: null }
  const response = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: getAuthRedirectUrl(AUTH_PATHS.clientAccess) },
  })
  return { unavailable: false, error: response.error }
}

export async function requestPasswordReset({ email }: PasswordRecoveryInput) {
  if (!supabase) return { unavailable: true, error: null }
  const response = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl(AUTH_PATHS.passwordReset),
  })
  return { unavailable: false, error: response.error }
}

export async function updatePassword(password: string) {
  if (!supabase) return { unavailable: true, error: null }
  const response = await supabase.auth.updateUser({ password })
  return { unavailable: false, error: response.error }
}
