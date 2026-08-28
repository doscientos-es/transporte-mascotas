import './App.css'
import { useAuthSession } from './hooks/use-auth-session'
import {
  clientSections,
  dashboardLocationForPath,
  isDashboardPath,
} from './lib/dashboard-navigation'
import { isSupabaseConfigured } from './lib/supabase'
import { DashboardPage } from './pages/dashboard-page'
import { LoginPage } from './pages/login-page'

function App() {
  const { session, ready, profile, profileReady } = useAuthSession()
  const pathname = window.location.pathname
  const location = dashboardLocationForPath(pathname, 'mis-transportes')
  const isStaffAccess =
    pathname.startsWith('/admin') ||
    (pathname !== '/' && isDashboardPath(pathname) && !clientSections.has(location.section))
  if (!ready || (session && !profileReady))
    return <div className="loading-screen">Cargando sesión segura…</div>
  if (!isSupabaseConfigured)
    return <div className="loading-screen">Configura Supabase para acceder a la aplicación.</div>
  if (isSupabaseConfigured && !session)
    return <LoginPage audience={isStaffAccess ? 'staff' : 'client'} />
  if (!profile) return <div className="loading-screen">No se ha podido cargar tu perfil.</div>
  return <DashboardPage session={session} profile={profile} />
}

export default App
