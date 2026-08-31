import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

import { isSupabaseConfigured, supabase } from '@/shared/infrastructure/supabase'
import type { UserProfile } from '@/shared/types'

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileReady, setProfileReady] = useState(!isSupabaseConfigured)
  const [authError, setAuthError] = useState('')
  const [profileError, setProfileError] = useState('')
  const [reloadAttempt, setReloadAttempt] = useState(0)

  useEffect(() => {
    if (!supabase) return

    let active = true
    setReady(false)
    setAuthError('')
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return
        if (error) throw error
        setSession(data.session)
      })
      .catch(() => {
        if (!active) return
        setSession(null)
        setAuthError(
          'No hemos podido comprobar tu sesión. Revisa tu conexión e inténtalo de nuevo.',
        )
      })
      .finally(() => {
        if (active) setReady(true)
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) =>
      setSession(nextSession),
    )
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [reloadAttempt])

  useEffect(() => {
    if (!supabase || !session) {
      setProfile(null)
      setProfileReady(true)
      return
    }
    let active = true
    setProfileReady(false)
    setProfileError('')
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name,phone,role')
          .eq('id', session.user.id)
          .single()
        if (!active) return
        if (error) throw error
        setProfile(
          data
            ? { displayName: data.display_name, phone: data.phone ?? '', role: data.role }
            : null,
        )
      } catch {
        if (!active) return
        setProfile(null)
        setProfileError('No hemos podido cargar tu perfil. Inténtalo de nuevo en unos segundos.')
      } finally {
        if (active) setProfileReady(true)
      }
    })()
    return () => {
      active = false
    }
  }, [reloadAttempt, session])

  return {
    session,
    ready,
    profile,
    profileReady,
    authError,
    profileError,
    retry: () => setReloadAttempt((attempt) => attempt + 1),
    signOut: async () => {
      if (!supabase) return
      await supabase.auth.signOut({ scope: 'local' })
    },
  }
}
