import { Button } from '@doscientos/ui'
import type { Session } from '@supabase/supabase-js'
import { ArrowLeft, CircleAlert, RefreshCw, ShieldCheck } from 'lucide-react'
import { createContext, Suspense, useContext } from 'react'
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  ScrollRestoration,
  useNavigation,
  useOutletContext,
  useRouteError,
} from 'react-router-dom'

import { isClientRole, type DashboardNavigation, type UserProfile } from '@/shared/types'

import { APP_PATHS, DEFAULT_DASHBOARD_SECTIONS, ROUTER_PATHS } from './router/dashboard-routes'
import { useDashboardNavigation } from './router/use-dashboard-navigation'

type AuthState = { session: Session | null; profile: UserProfile | null }
type AuthenticatedRouteContext = { session: Session; profile: UserProfile }
type DashboardRouteContext = AuthenticatedRouteContext & { navigation: DashboardNavigation }

const AuthContext = createContext<AuthState>({ session: null, profile: null })
const clientPortalRoute = () => import('./router/client-portal-route')
const staffDashboardRoute = () => import('./router/staff-dashboard-route')

const router = createBrowserRouter([
  {
    Component: RootLayout,
    HydrateFallback: LoadingRoute,
    errorElement: <RouteErrorBoundary returnTo={APP_PATHS.home} />,
    children: [
      {
        Component: PublicRoute,
        errorElement: <RouteErrorBoundary returnTo={APP_PATHS.home} />,
        children: [
          {
            index: true,
            lazy: () => import('./router/login-route'),
            HydrateFallback: LoadingRoute,
          },
          {
            path: ROUTER_PATHS.staffAccess,
            lazy: () => import('./router/login-route'),
            HydrateFallback: LoadingRoute,
          },
        ],
      },
      {
        Component: ClientRouteGuard,
        errorElement: <RouteErrorBoundary returnTo={APP_PATHS.clientHome} />,
        children: [
          {
            path: ROUTER_PATHS.clientUpcoming,
            lazy: clientPortalRoute,
            HydrateFallback: LoadingRoute,
          },
          {
            path: ROUTER_PATHS.clientTransports,
            lazy: clientPortalRoute,
            HydrateFallback: LoadingRoute,
          },
          { path: ROUTER_PATHS.clientPets, lazy: clientPortalRoute, HydrateFallback: LoadingRoute },
        ],
      },
      {
        Component: StaffRouteGuard,
        errorElement: <RouteErrorBoundary returnTo={APP_PATHS.transporterHome} />,
        children: [
          {
            path: ROUTER_PATHS.staffRoutes,
            lazy: staffDashboardRoute,
            HydrateFallback: LoadingRoute,
          },
          {
            path: ROUTER_PATHS.staffRouteDetail,
            lazy: staffDashboardRoute,
            HydrateFallback: LoadingRoute,
          },
          { path: ROUTER_PATHS.staffVan, lazy: staffDashboardRoute, HydrateFallback: LoadingRoute },
          {
            path: ROUTER_PATHS.staffVanDetail,
            lazy: staffDashboardRoute,
            HydrateFallback: LoadingRoute,
          },
          {
            path: ROUTER_PATHS.staffInvoices,
            lazy: staffDashboardRoute,
            HydrateFallback: LoadingRoute,
          },
          {
            Component: AdminRouteGuard,
            errorElement: <RouteErrorBoundary returnTo={APP_PATHS.staffHome} />,
            children: [
              {
                path: ROUTER_PATHS.adminLetters,
                lazy: staffDashboardRoute,
                HydrateFallback: LoadingRoute,
              },
              {
                path: ROUTER_PATHS.adminClients,
                lazy: staffDashboardRoute,
                HydrateFallback: LoadingRoute,
              },
              {
                path: ROUTER_PATHS.adminTemplates,
                lazy: staffDashboardRoute,
                HydrateFallback: LoadingRoute,
              },
              {
                path: ROUTER_PATHS.adminRequests,
                lazy: staffDashboardRoute,
                HydrateFallback: LoadingRoute,
              },
              {
                path: ROUTER_PATHS.adminSettings,
                lazy: staffDashboardRoute,
                HydrateFallback: LoadingRoute,
              },
              {
                path: ROUTER_PATHS.adminWhatsApp,
                lazy: staffDashboardRoute,
                HydrateFallback: LoadingRoute,
              },
            ],
          },
        ],
      },
      {
        path: ROUTER_PATHS.notFound,
        lazy: () => import('./router/not-found-route'),
        HydrateFallback: LoadingRoute,
      },
    ],
  },
])

export function AppRouter({ session, profile }: AuthState) {
  return (
    <AuthContext.Provider value={{ session, profile }}>
      <RouterProvider router={router} />
    </AuthContext.Provider>
  )
}

function RootLayout() {
  const navigation = useNavigation()
  return (
    <>
      {navigation.state !== 'idle' && <LoadingRoute />}
      <Suspense fallback={<LoadingRoute />}>
        <Outlet />
      </Suspense>
      <ScrollRestoration />
    </>
  )
}

function PublicRoute() {
  return <Outlet context={useAuth()} />
}

function ClientRouteGuard() {
  const auth = useAuth()
  if (!auth.session || !auth.profile) return <Navigate to={APP_PATHS.home} replace />
  if (!isClientRole(auth.profile.role)) return <Navigate to={APP_PATHS.staffHome} replace />
  return (
    <DashboardRouteOutlet
      auth={auth as AuthenticatedRouteContext}
      fallback={DEFAULT_DASHBOARD_SECTIONS.client}
    />
  )
}

function StaffRouteGuard() {
  const auth = useAuth()
  if (!auth.session || !auth.profile) return <Navigate to={APP_PATHS.staffAccess} replace />
  if (isClientRole(auth.profile.role)) return <Navigate to={APP_PATHS.clientHome} replace />
  return (
    <DashboardRouteOutlet
      auth={auth as AuthenticatedRouteContext}
      fallback={DEFAULT_DASHBOARD_SECTIONS.staff}
    />
  )
}

function AdminRouteGuard() {
  const auth = useAuth()
  const context = useOutletContext<DashboardRouteContext>()
  if (auth.profile?.role !== 'admin') return <Navigate to={APP_PATHS.transporterHome} replace />
  return <Outlet context={context} />
}

function DashboardRouteOutlet({
  auth,
  fallback,
}: {
  auth: AuthenticatedRouteContext
  fallback: DashboardNavigation['section']
}) {
  const navigation = useDashboardNavigation(fallback)
  return <Outlet context={{ ...auth, navigation } satisfies DashboardRouteContext} />
}

function useAuth() {
  return useContext(AuthContext)
}

function LoadingRoute() {
  return (
    <output className="loading-screen" aria-live="polite">
      Cargando página…
    </output>
  )
}

function RouteErrorBoundary({ returnTo }: { returnTo: string }) {
  useRouteError()
  return (
    <main className="loading-screen route-error-state" role="alert">
      <section className="route-error-card" aria-labelledby="route-error-title">
        <div className="route-error-icon" aria-hidden="true">
          <CircleAlert size={28} />
        </div>
        <p className="route-error-eyebrow">Problema de navegación</p>
        <h1 id="route-error-title">Esta página no se ha podido abrir</h1>
        <p className="route-error-copy">
          Puede que el enlace ya no esté disponible o que haya ocurrido un problema puntual.
        </p>
        <div className="route-error-actions">
          <Button onClick={() => window.location.assign(returnTo)}>
            <ArrowLeft /> Volver a una zona segura
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw /> Recargar aplicación
          </Button>
        </div>
        <p className="route-error-reassurance">
          <ShieldCheck size={17} aria-hidden="true" /> Tus datos no se han modificado.
        </p>
      </section>
    </main>
  )
}
