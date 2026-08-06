import './App.css'
import { useAuthSession } from './hooks/use-auth-session'
import { isSupabaseConfigured } from './lib/supabase'
import { DashboardPage } from './pages/dashboard-page'
import { LoginPage } from './pages/login-page'

function App() {
  const { session, ready, profile, profileReady } = useAuthSession()
  if (!ready || (session && !profileReady)) return <div className="loading-screen">Cargando sesión segura…</div>
  if (isSupabaseConfigured && !session) return <LoginPage />
  if (!profile) return <div className="loading-screen">No se ha podido cargar tu perfil.</div>
  return <DashboardPage session={session} profile={profile} />
}

export default App
