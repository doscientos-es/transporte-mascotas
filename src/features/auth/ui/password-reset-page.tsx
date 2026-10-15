import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Field,
  FieldLabel,
  LinkButton,
  PasswordInput,
} from '@doscientos/ui'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { AUTH_PATHS } from '@/shared/constants/auth-paths'
import { supabase } from '@/shared/infrastructure/supabase'
import { BrandLogo } from '@/shared/ui/brand-logo'

import { getPasswordResetFeedback, type AuthFeedback } from '../application/auth-feedback'
import { updatePassword } from '../application/authenticate'

type ResetStatus = 'checking' | 'ready' | 'invalid' | 'unavailable' | 'success'

export function PasswordResetPage() {
  const [status, setStatus] = useState<ResetStatus>('checking')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null)
  const [sending, setSending] = useState(false)
  const accessPath = AUTH_PATHS.clientAccess
  const recoveryPath = AUTH_PATHS.passwordRecovery

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
    <AuthShell
      title="Crea una contraseña nueva"
      description="Elige una contraseña segura de al menos 8 caracteres."
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => void resetPassword(event)}
        aria-busy={sending}
      >
        <Field>
          <FieldLabel htmlFor="reset-password">Nueva contraseña</FieldLabel>
          <PasswordInput
            id="reset-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            enterKeyHint="next"
            minLength={8}
            placeholder="Al menos 8 caracteres"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="reset-confirmation">Repite la contraseña</FieldLabel>
          <PasswordInput
            id="reset-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="new-password"
            enterKeyHint="go"
            minLength={8}
            required
          />
        </Field>
        {feedback && (
          <Alert variant={feedback.tone === 'error' ? 'destructive' : feedback.tone} role="alert">
            <AlertDescription>{feedback.message}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={sending}>
          {sending ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </form>
    </AuthShell>
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
    <AuthShell title={isError ? 'No podemos continuar' : 'Un momento'} description={message}>
      {actionHref && (
        <LinkButton size="lg" className="w-full" href={actionHref}>
          {actionLabel}
        </LinkButton>
      )}
    </AuthShell>
  )
}

function AuthShell({
  children,
  description,
  title,
}: {
  children?: ReactNode
  description: string
  title: string
}) {
  return (
    <main className="login-screen">
      <Card className="w-full max-w-110 py-0 shadow-[0_20px_60px_rgb(0_0_0_/_8%)]">
        <CardContent className="grid gap-6 p-6 sm:p-9">
          <div className="grid gap-3">
            <div className="flex items-center gap-2.5">
              <BrandLogo className="h-9 w-11 object-contain" />
              <span className="text-[15px] leading-[1.05] font-[650]">Kache Envíos</span>
            </div>
            <h1 className="m-0 text-[clamp(26px,5vw,34px)] leading-[1.05] font-bold tracking-[-0.045em]">
              {title}
            </h1>
            <p className="text-muted-foreground m-0 text-sm leading-6">{description}</p>
          </div>
          {children}
        </CardContent>
      </Card>
    </main>
  )
}
