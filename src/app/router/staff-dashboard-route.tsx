import type { Session } from '@supabase/supabase-js'
import { useOutletContext } from 'react-router-dom'

import { StaffDashboardRoutePage } from '@/pages/staff-dashboard'
import type { DashboardNavigation, UserProfile } from '@/shared/types'

type DashboardRouteContext = {
  session: Session
  profile: UserProfile
  navigation: DashboardNavigation
}

export function Component() {
  const { session, profile, navigation } = useOutletContext<DashboardRouteContext>()
  return <StaffDashboardRoutePage session={session} profile={profile} navigation={navigation} />
}
