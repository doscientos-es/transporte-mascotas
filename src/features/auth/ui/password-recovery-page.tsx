import { Button } from '@doscientos/ui'
import { useState, type FormEvent } from 'react'

import { AUTH_PATHS } from '@/shared/constants/auth-paths'
import { BrandLogo } from '@/shared/ui/brand-logo'

import { getPasswordRecoveryFeedback, type AuthFeedback } from '../application/auth-feedback'
import { requestPasswordReset } from '../application/authenticate'

type Props = { audience: 'client' | 'staff' }

export function PasswordRecoveryPage({ audience }: Props) {
  const [email, setEmail] = useState('')
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null)
  const [sending, setSending] = useState(false)
  const accessPath = audience === 'client' ? AUTH_PATHS.clientAccess : AUTH_PATHS.staffAccess

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setFeedback(null)
    try {
      const response = await requestPasswordReset({ email, audience })
      if (response.unavailable) {
        setFeedback({ tone: 'error', message: 'El acceso no está configurado en este entorno.' })
      } else if (response.error) {
        setFeedback(getPasswordRecoveryFeedback(response.error))
      } else {
        setFeedback({
          tone: 'success',
          message:
            'Si existe una cuenta con este correo, recibirás un enlace para recuperar el acceso.',
        })
      }
    } catch {
      setFeedback({
        tone: 'error',
        message: 'No hemos podido enviar el enlace. Comprueba tu conexión e inténtalo de nuevo.',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="login-screen auth-flow-screen">
      <section className="login-card">
        <BrandLogo />
        <h1>Recupera tu acceso</h1>
        <p>Te enviaremos un enlace para crear una contraseña nueva.</p>
        <form onSubmit={(event) => void requestReset(event)}>
          <label>
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="tu@email.com"
              required
            />
          </label>
          {feedback && (
            <div
              className={`form-feedback form-feedback-${feedback.tone}`}
              role={feedback.tone === 'error' ? 'alert' : 'status'}
            >
              <p>{feedback.message}</p>
            </div>
          )}
          <Button type="submit" disabled={sending}>
            {sending ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        </form>
        <a className="auth-flow-link" href={accessPath}>
          Volver a iniciar sesión
        </a>
      </section>
    </main>
  )
}
