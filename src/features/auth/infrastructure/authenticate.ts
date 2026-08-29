import { supabase } from '@/shared/infrastructure/supabase'

type AuthenticationInput = {
  audience: 'client' | 'staff'
  displayName: string
  email: string
  mode: 'login' | 'signup'
  password: string
  phone: string
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
            data: {
              display_name: displayName,
              ...(audience === 'client' ? { phone, account_type: 'user' } : {}),
            },
          },
        })
  return { unavailable: false, error: response.error, hasSession: Boolean(response.data.session) }
}
