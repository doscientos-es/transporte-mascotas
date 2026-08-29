import type { Session } from '@supabase/supabase-js'
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
    errorElement: <RouteErrorBoundary returnTo="/" />,
    children: [
      {
        Component: PublicRoute,
        errorElement: <RouteErrorBoundary returnTo="/" />,
        children: [
          {
            index: true,
            lazy: () => import('./router/login-route'),
            HydrateFallback: LoadingRoute,
          },
          {
            path: 'admin/*',
            lazy: () => import('./router/login-route'),
            HydrateFallback: LoadingRoute,
          },
        ],
      },
      {
        Component: ClientRouteGuard,
        errorElement: <RouteErrorBoundary returnTo="/mis-transportes" />,
        children: [
          { path: 'proximas-rutas', lazy: clientPortalRoute, HydrateFallback: LoadingRoute },
          { path: 'mis-transportes', lazy: clientPortalRoute, HydrateFallback: LoadingRoute },
          { path: 'mis-mascotas', lazy: clientPortalRoute, HydrateFallback: LoadingRoute },
        ],
      },
      {
        Component: StaffRouteGuard,
        errorElement: <RouteErrorBoundary returnTo="/rutas" />,
        children: [
          { path: 'rutas', lazy: staffDashboardRoute, HydrateFallback: LoadingRoute },
          { path: 'rutas/:routeId', lazy: staffDashboardRoute, HydrateFallback: LoadingRoute },
          { path: 'furgoneta', lazy: staffDashboardRoute, HydrateFallback: LoadingRoute },
          { path: 'furgoneta/:routeId', lazy: staffDashboardRoute, HydrateFallback: LoadingRoute },
          { path: 'facturas', lazy: staffDashboardRoute, HydrateFallback: LoadingRoute },
          {
            Component: AdminRouteGuard,
            errorElement: <RouteErrorBoundary returnTo="/cartas" />,
            children: [
              { path: 'cartas', lazy: staffDashboardRoute, HydrateFallback: LoadingRoute },
              { path: 'clientes', lazy: staffDashboardRoute, HydrateFallback: LoadingRoute },
              {
                path: 'rutas-preestablecidas',
                lazy: staffDashboardRoute,
                HydrateFallback: LoadingRoute,
              },
              { path: 'solicitudes', lazy: staffDashboardRoute, HydrateFallback: LoadingRoute },
              { path: 'ajustes', lazy: staffDashboardRoute, HydrateFallback: LoadingRoute },
              {
                path: 'ajustes/whatsapp',
                lazy: staffDashboardRoute,
                HydrateFallback: LoadingRoute,
              },
            ],
          },
        ],
      },
      { path: '*', lazy: () => import('./router/not-found-route'), HydrateFallback: LoadingRoute },
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
  if (!auth.session || !auth.profile) return <Navigate to="/" replace />
  if (!isClientRole(auth.profile.role)) return <Navigate to="/cartas" replace />
  return (
    <DashboardRouteOutlet auth={auth as AuthenticatedRouteContext} fallback="mis-transportes" />
  )
}

function StaffRouteGuard() {
  const auth = useAuth()
  if (!auth.session || !auth.profile) return <Navigate to="/admin" replace />
  if (isClientRole(auth.profile.role)) return <Navigate to="/mis-transportes" replace />
  return <DashboardRouteOutlet auth={auth as AuthenticatedRouteContext} fallback="cartas" />
}

function AdminRouteGuard() {
  const auth = useAuth()
  const context = useOutletContext<DashboardRouteContext>()
  if (auth.profile?.role !== 'admin') return <Navigate to="/rutas" replace />
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
    <main className="loading-screen app-state" role="alert">
      <div>
        <h1>No hemos podido abrir esta página</h1>
        <p>Vuelve a intentarlo o recarga la aplicación. Tus datos no se han modificado.</p>
        <button type="button" onClick={() => window.location.assign(returnTo)}>
          Volver a una página segura
        </button>
        <button type="button" onClick={() => window.location.reload()}>
          Recargar aplicación
        </button>
      </div>
    </main>
  )
}
