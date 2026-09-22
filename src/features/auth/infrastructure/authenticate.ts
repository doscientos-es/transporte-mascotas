import { AUTH_PATHS } from '@/shared/constants/auth-paths'
import { supabase } from '@/shared/infrastructure/supabase'

type AuthenticationInput = {
  audience: 'client' | 'staff'
  displayName: string
  email: string
  mode: 'login' | 'signup'
  password: string
  phone: string
}

type PasswordRecoveryInput = {
  audience: 'client' | 'staff'
  email: string
}

function getAuthRedirectUrl(path: string) {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

function getPasswordResetRedirectUrl(audience: 'client' | 'staff') {
  const path = new URL(AUTH_PATHS.passwordReset, 'http://localhost')
  path.searchParams.set('audience', audience)
  return getAuthRedirectUrl(`${path.pathname}${path.search}`)
}

export async function authenticate({
  audience,
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
            emailRedirectTo: getAuthRedirectUrl(
              audience === 'client' ? AUTH_PATHS.clientAccess : AUTH_PATHS.staffAccess,
            ),
            data: {
              display_name: displayName,
              ...(audience === 'client' ? { phone, account_type: 'user' } : {}),
            },
          },
        })
  return { unavailable: false, error: response.error, hasSession: Boolean(response.data.session) }
}

export async function requestPasswordReset({ email, audience }: PasswordRecoveryInput) {
  if (!supabase) return { unavailable: true, error: null }
  const response = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl(audience),
  })
  return { unavailable: false, error: response.error }
}

export async function updatePassword(password: string) {
  if (!supabase) return { unavailable: true, error: null }
  const response = await supabase.auth.updateUser({ password })
  return { unavailable: false, error: response.error }
}
