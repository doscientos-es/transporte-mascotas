import { Button } from '@doscientos/ui'
import { useEffect, useState, type FormEvent } from 'react'

import { AUTH_PATHS } from '@/shared/constants/auth-paths'
import { supabase } from '@/shared/infrastructure/supabase'
import { BrandLogo } from '@/shared/ui/brand-logo'

import { getPasswordResetFeedback, type AuthFeedback } from '../application/auth-feedback'
import { updatePassword } from '../application/authenticate'

type Props = { audience: 'client' | 'staff' }
type ResetStatus = 'checking' | 'ready' | 'invalid' | 'unavailable' | 'success'

export function PasswordResetPage({ audience }: Props) {
  const [status, setStatus] = useState<ResetStatus>('checking')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null)
  const [sending, setSending] = useState(false)
  const accessPath = audience === 'client' ? AUTH_PATHS.clientAccess : AUTH_PATHS.staffAccess
  const recoveryPath = `${AUTH_PATHS.passwordRecovery}${audience === 'staff' ? '?audience=staff' : ''}`

  useEffect(() => {
    if (!supabase) {
      setStatus('unavailable')
      return
    }

    let active = true
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (active && nextSession && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
        setStatus('ready')
      }
    })

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return
        setStatus(error || !data.session ? 'invalid' : 'ready')
        if (!error && data.session && window.location.hash) {
          window.history.replaceState(
            null,
            document.title,
            `${window.location.pathname}${window.location.search}`,
          )
        }
      })
      .catch(() => {
        if (active) setStatus('invalid')
      })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmation) {
      setFeedback({ tone: 'error', message: 'Las contraseñas no coinciden.' })
      return
    }

    setSending(true)
    setFeedback(null)
    try {
      const response = await updatePassword(password)
      if (response.unavailable) {
        setFeedback({ tone: 'error', message: 'El acceso no está configurado en este entorno.' })
      } else if (response.error) {
        setFeedback(getPasswordResetFeedback(response.error))
      } else {
        setStatus('success')
      }
    } catch {
      setFeedback({
        tone: 'error',
        message: 'No hemos podido cambiar la contraseña. Inténtalo de nuevo.',
      })
    } finally {
      setSending(false)
    }
  }

  if (status === 'checking') return <ResetState message="Comprobando tu enlace…" />
  if (status === 'unavailable') {
    return <ResetState message="El acceso no está configurado en este entorno." isError />
  }
  if (status === 'invalid') {
    return (
      <ResetState
        message="Este enlace ha caducado o ya no es válido. Solicita uno nuevo para continuar."
        actionHref={recoveryPath}
        actionLabel="Solicitar otro enlace"
        isError
      />
    )
  }
  if (status === 'success') {
    return (
      <ResetState
        message="Tu contraseña se ha actualizado correctamente."
        actionHref={accessPath}
        actionLabel="Continuar"
      />
    )
  }

  return (
    <main className="login-screen auth-flow-screen">
      <section className="login-card">
        <BrandLogo />
        <h1>Crea una contraseña nueva</h1>
        <p>Elige una contraseña segura de al menos 8 caracteres.</p>
        <form onSubmit={(event) => void resetPassword(event)}>
          <label>
            Nueva contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label>
            Repite la contraseña
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {feedback && (
            <div className={`form-feedback form-feedback-${feedback.tone}`} role="alert">
              <p>{feedback.message}</p>
            </div>
          )}
          <Button type="submit" disabled={sending}>
            {sending ? 'Guardando…' : 'Guardar contraseña'}
          </Button>
        </form>
      </section>
    </main>
  )
}

function ResetState({
  actionHref,
  actionLabel,
  isError = false,
  message,
}: {
  actionHref?: string
  actionLabel?: string
  isError?: boolean
  message: string
}) {
  return (
    <main className="login-screen auth-flow-screen">
      <section className="login-card auth-state-card">
        <BrandLogo />
        <h1>{isError ? 'No podemos continuar' : 'Un momento'}</h1>
        <p>{message}</p>
        {actionHref && (
          <a className="auth-flow-link" href={actionHref}>
            {actionLabel}
          </a>
        )}
      </section>
    </main>
  )
}
