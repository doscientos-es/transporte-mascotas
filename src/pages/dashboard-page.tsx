import type { Session } from '@supabase/supabase-js'
import { lazy, Suspense } from 'react'
import { isClientRole, type UserProfile } from '../lib/types'

// The client and operational experiences have separate bundles so a client
// never loads internal route, invoice, or PDF tooling.
const AdminDashboardPage = lazy(() =>
  import('./admin-dashboard-page').then(({ AdminDashboardPage: page }) => ({ default: page })),
)
const ClientPortalPage = lazy(() =>
  import('./client-portal-page').then(({ ClientPortalPage: page }) => ({ default: page })),
)

export function DashboardPage({
  session,
  profile,
}: {
  session: Session | null
  profile: UserProfile
}) {
  return (
    <Suspense fallback={<div className="loading-screen">Cargando…</div>}>
      {isClientRole(profile.role) ? (
        <ClientPortalPage session={session} profile={profile} />
      ) : (
        <AdminDashboardPage session={session} profile={profile} />
      )}
    </Suspense>
  )
}
