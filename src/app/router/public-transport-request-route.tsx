import type { Session } from '@supabase/supabase-js'
import { Navigate, useLocation, useOutletContext } from 'react-router-dom'

import { PublicTransportRequestRoutePage } from '@/pages/public-transport-request'
import { isClientRole, type UserProfile } from '@/shared/types'

import { APP_PATHS, dashboardPathFor } from './dashboard-routes'

type PublicRouteContext = { session: Session | null; profile: UserProfile | null }

export function Component() {
  const { session, profile } = useOutletContext<PublicRouteContext>()
  const { search } = useLocation()
  if (session && profile && !session.user.is_anonymous) {
    const routeId = new URLSearchParams(search).get('ruta')
    if (!isClientRole(profile.role)) return <Navigate to={APP_PATHS.staffHome} replace />
    return routeId ? (
      <Navigate
        to={dashboardPathFor('mis-transportes')}
        state={{ preselectRouteId: routeId }}
        replace
      />
    ) : (
      <Navigate to={APP_PATHS.clientHome} replace />
    )
  }
  return <PublicTransportRequestRoutePage />
}
