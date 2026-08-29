import './App.css'
import './styles/responsive.css'
import { Component, useEffect, useState, type ReactNode } from 'react'

import { useAuthSession } from '@/features/auth'
import { isSupabaseConfigured } from '@/shared/infrastructure/supabase'
import { PwaInstallPrompt } from '@/shared/ui/pwa-install-prompt'

import { AppRouter } from './router'

function App() {
  return (
    <AppErrorBoundary>
      <RuntimeErrorGuard>
        <AuthenticatedApp />
        <PwaInstallPrompt />
      </RuntimeErrorGuard>
    </AppErrorBoundary>
  )
}

function AuthenticatedApp() {
  const { session, ready, profile, profileReady, authError, profileError, retry } = useAuthSession()
  if (!ready || (session && !profileReady))
    return (
      <output className="loading-screen" aria-live="polite">
        Cargando sesión segura…
      </output>
    )
  if (!isSupabaseConfigured)
    return (
      <div className="loading-screen" role="alert">
        Configura Supabase para acceder a la aplicación.
      </div>
    )
  if (authError) return <AppState message={authError} onRetry={retry} />
  if (!profile)
    return session ? (
      <AppState message={profileError || 'No se ha podido cargar tu perfil.'} onRetry={retry} />
    ) : (
      <AppRouter session={session} profile={profile} />
    )
  return <AppRouter session={session} profile={profile} />
}

function AppState({
  title = 'Necesitamos volver a intentarlo',
  message,
  onRetry,
  actionLabel = 'Reintentar',
}: {
  title?: string
  message: string
  onRetry: () => void
  actionLabel?: string
}) {
  return (
    <main className="loading-screen app-state" role="alert">
      <div>
        <h1>{title}</h1>
        <p>{message}</p>
        <button type="button" onClick={onRetry}>
          {actionLabel}
        </button>
      </div>
    </main>
  )
}

function RuntimeErrorGuard({ children }: { children: ReactNode }) {
  const [hasUnexpectedError, setHasUnexpectedError] = useState(false)

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error || event.message) setHasUnexpectedError(true)
    }
    const handleUnhandledRejection = () => setHasUnexpectedError(true)
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  if (hasUnexpectedError)
    return (
      <AppState
        title="Vamos a solucionarlo"
        message="Algo no ha salido como esperábamos. Recarga la aplicación para continuar con tranquilidad."
        onRetry={() => window.location.reload()}
        actionLabel="Recargar aplicación"
      />
    )

  return children
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError)
      return (
        <AppState
          title="Vamos a solucionarlo"
          message="Algo no ha salido como esperábamos. Tus datos no se han modificado. Recarga la aplicación para continuar."
          onRetry={() => window.location.reload()}
          actionLabel="Recargar aplicación"
        />
      )
    return this.props.children
  }
}

export default App
