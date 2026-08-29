import { supabase } from '@/shared/infrastructure/supabase'

export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
