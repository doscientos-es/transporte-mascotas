import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { UserProfile } from '../lib/types'

const demoProfile: UserProfile = { displayName: 'Gestor', role: 'admin' }

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [profile, setProfile] = useState<UserProfile | null>(isSupabaseConfigured ? null : demoProfile)
  const [profileReady, setProfileReady] = useState(!isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      setProfile(isSupabaseConfigured ? null : demoProfile)
      setProfileReady(true)
      return
    }
    let active = true
    setProfileReady(false)
    supabase.from('profiles').select('display_name,role').eq('id', session.user.id).single().then(({ data }) => {
      if (!active) return
      setProfile(data ? { displayName: data.display_name, role: data.role } : null)
      setProfileReady(true)
    })
    return () => { active = false }
  }, [session])

  return { session, ready, profile, profileReady }
}
