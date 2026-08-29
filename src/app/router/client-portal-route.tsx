import type { Session } from '@supabase/supabase-js'
import { useOutletContext } from 'react-router-dom'

import { ClientPortalRoutePage } from '@/pages/client-portal'
import type { DashboardNavigation, UserProfile } from '@/shared/types'

type DashboardRouteContext = {
  session: Session
  profile: UserProfile
  navigation: DashboardNavigation
}

export function Component() {
  const { session, profile, navigation } = useOutletContext<DashboardRouteContext>()
  return <ClientPortalRoutePage session={session} profile={profile} navigation={navigation} />
}
