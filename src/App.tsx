import './App.css'
import { useAuthSession } from './hooks/use-auth-session'
import { isSupabaseConfigured } from './lib/supabase'
import { DashboardPage } from './pages/dashboard-page'
import { LoginPage } from './pages/login-page'

function App() {
  const { session, ready } = useAuthSession()
  if (!ready) return <div className="loading-screen">Cargando sesión segura…</div>
  if (isSupabaseConfigured && !session) return <LoginPage />
  return <DashboardPage session={session} />
}

export default App
