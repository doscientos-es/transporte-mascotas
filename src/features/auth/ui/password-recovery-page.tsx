import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Field,
  FieldLabel,
  Input,
  LinkButton,
  Separator,
} from '@doscientos/ui'
import { useState, type FormEvent } from 'react'

import { AUTH_PATHS } from '@/shared/constants/auth-paths'
import { BrandLogo } from '@/shared/ui/brand-logo'

import { getPasswordRecoveryFeedback, type AuthFeedback } from '../application/auth-feedback'
import { requestPasswordReset } from '../application/authenticate'

export function PasswordRecoveryPage() {
  const [email, setEmail] = useState('')
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null)
  const [sending, setSending] = useState(false)

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setFeedback(null)
    try {
      const response = await requestPasswordReset({ email })
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
    <main className="login-screen">
      <Card className="w-full max-w-110 py-0 shadow-[0_20px_60px_rgb(0_0_0_/_8%)]">
        <CardContent className="grid gap-6 p-6 sm:p-9">
          <div className="grid gap-3">
            <div className="flex items-center gap-2.5">
              <BrandLogo className="h-9 w-11 object-contain" />
              <span className="text-[15px] leading-[1.05] font-[650]">Kache Envíos</span>
            </div>
            <h1 className="m-0 text-[clamp(26px,5vw,34px)] leading-[1.05] font-bold tracking-[-0.045em]">
              Recupera tu acceso
            </h1>
            <p className="text-muted-foreground m-0 text-sm leading-6">
              Te enviaremos un enlace para crear una contraseña nueva.
            </p>
          </div>
          <form
            className="grid gap-4"
            onSubmit={(event) => void requestReset(event)}
            aria-busy={sending}
          >
            <Field>
              <FieldLabel htmlFor="recovery-email">Correo electrónico</FieldLabel>
              <Input
                id="recovery-email"
                className="min-h-11"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="email"
                enterKeyHint="send"
                placeholder="tu@email.com"
                required
              />
            </Field>
            {feedback && (
              <Alert
                variant={feedback.tone === 'error' ? 'destructive' : feedback.tone}
                role={feedback.tone === 'error' ? 'alert' : 'status'}
              >
                <AlertDescription>{feedback.message}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={sending}>
              {sending ? 'Enviando…' : 'Enviar enlace'}
            </Button>
          </form>
          <Separator />
          <LinkButton variant="ghost" className="w-full" href={AUTH_PATHS.clientAccess}>
            Volver a iniciar sesión
          </LinkButton>
        </CardContent>
      </Card>
    </main>
  )
}
