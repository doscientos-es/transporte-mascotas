import type { Session } from '@supabase/supabase-js'
import { Navigate, useLocation, useOutletContext } from 'react-router-dom'

import { LoginRoutePage } from '@/pages/login'
import { isClientRole, type UserProfile } from '@/shared/types'

import { APP_PATHS, isStaffAccessPath, paymentReturnStateFromSearch } from './dashboard-routes'

type PublicRouteContext = { session: Session | null; profile: UserProfile | null }

export function Component() {
  const { session, profile } = useOutletContext<PublicRouteContext>()
  const { pathname, search } = useLocation()
  const paymentState = paymentReturnStateFromSearch(search)
  if (session && profile)
    return (
      <Navigate
        to={isClientRole(profile.role) ? APP_PATHS.clientHome : APP_PATHS.staffHome}
        state={paymentState}
        replace
      />
    )
  return <LoginRoutePage audience={isStaffAccessPath(pathname) ? 'staff' : 'client'} />
}
