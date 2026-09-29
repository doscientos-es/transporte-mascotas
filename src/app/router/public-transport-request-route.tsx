import type { Session } from '@supabase/supabase-js'
import { Navigate, useOutletContext } from 'react-router-dom'

import { PublicTransportRequestRoutePage } from '@/pages/public-transport-request'
import { isClientRole, type UserProfile } from '@/shared/types'

import { APP_PATHS } from './dashboard-routes'

type PublicRouteContext = { session: Session | null; profile: UserProfile | null }

export function Component() {
  const { session, profile } = useOutletContext<PublicRouteContext>()
  if (session && profile && !session.user.is_anonymous)
    return (
      <Navigate
        to={isClientRole(profile.role) ? APP_PATHS.clientHome : APP_PATHS.staffHome}
        replace
      />
    )
  return <PublicTransportRequestRoutePage />
}
