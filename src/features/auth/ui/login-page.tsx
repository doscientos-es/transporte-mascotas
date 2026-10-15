import {
  Alert,
  AlertAction,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  LinkButton,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@doscientos/ui'
import { CheckCircle2, PawPrint, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { AUTH_PATHS } from '@/shared/constants/auth-paths'
import { BrandLogo } from '@/shared/ui/brand-logo'

import { getAuthFeedback, type AuthFeedback } from '../application/auth-feedback'
import { authenticate, resendConfirmation } from '../application/authenticate'
import { PasswordInput } from './password-input'

type FieldErrors = Partial<Record<'displayName' | 'phone' | 'email' | 'password', string>>

const MIN_PASSWORD = 8
const RESEND_COOLDOWN_SECONDS = 60
const LAST_EMAIL_KEY = 'kache:last-email'
const FIELD_ORDER = ['displayName', 'phone', 'email', 'password'] as const
const FIELD_IDS = {
  displayName: 'login-name',
  phone: 'login-phone',
  email: 'login-email',
  password: 'login-password',
} as const

function readLastEmail() {
  try {
    return window.localStorage.getItem(LAST_EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveLastEmail(email: string) {
  try {
    window.localStorage.setItem(LAST_EMAIL_KEY, email)
  } catch {
    // Storage can be unavailable (private mode); remembering the email is optional.
  }
}

function validate(input: {
  displayName: string
  email: string
  mode: 'login' | 'signup'
  password: string
  phone: string
}): FieldErrors {
  const errors: FieldErrors = {}
  if (input.mode === 'signup' && !input.displayName.trim()) {
    errors.displayName = 'Escribe tu nombre y apellidos.'
  }
  if (input.mode === 'signup' && input.phone.replace(/\D/g, '').length < 6) {
    errors.phone = 'Escribe un teléfono válido para poder avisarte.'
  }
  if (!input.email.trim()) errors.email = 'Escribe tu correo electrónico.'
  else if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) errors.email = 'Introduce un correo válido.'
  if (!input.password) errors.password = 'Escribe tu contraseña.'
  else if (input.mode === 'signup' && input.password.length < MIN_PASSWORD) {
    const missing = MIN_PASSWORD - input.password.length
    errors.password = `Faltan ${missing} ${missing === 1 ? 'carácter' : 'caracteres'}.`
  }
  return errors
}

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(readLastEmail)
  const [password, setPassword] = useState('')
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null)
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [capsLock, setCapsLock] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  async function resend() {
    const address = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setErrors({ email: 'Escribe el correo con el que te registraste.' })
      document.getElementById(FIELD_IDS.email)?.focus()
      return
    }
    setResending(true)
    try {
      const response = await resendConfirmation({ email: address })
      if (response.unavailable) {
        setFeedback({ tone: 'error', message: 'El acceso no está configurado en este entorno.' })
      } else if (response.error) {
        setFeedback(getAuthFeedback(response.error, 'login'))
        setCooldown(RESEND_COOLDOWN_SECONDS)
      } else {
        setFeedback({
          tone: 'success',
          message: `Te hemos reenviado el correo a ${address}. Revisa también la carpeta de spam.`,
          action: 'resend',
        })
        setCooldown(RESEND_COOLDOWN_SECONDS)
      }
    } catch {
      setFeedback({
        tone: 'error',
        message: 'No se ha podido reenviar el correo. Comprueba tu conexión e inténtalo de nuevo.',
      })
    } finally {
      setResending(false)
    }
  }

  function changeMode(next: 'login' | 'signup') {
    setMode(next)
    setFeedback(null)
    setErrors({})
  }

  function clearError(field: keyof FieldErrors) {
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = validate({ displayName, email, mode, password, phone })
    setErrors(found)
    const firstInvalid = FIELD_ORDER.find((field) => found[field])
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus()
      return
    }
    setSending(true)
    setFeedback(null)
    try {
      const response = await authenticate({ displayName, email, mode, password, phone })
      if (response.unavailable) {
        setFeedback({ tone: 'error', message: 'El acceso no está configurado en este entorno.' })
      } else if (response.error) {
        setFeedback(getAuthFeedback(response.error, mode))
      } else if (mode === 'signup' && !response.hasSession) {
        saveLastEmail(email)
        setMode('login')
        setErrors({})
        setPassword('')
        setFeedback({
          tone: 'success',
          message: `Te hemos enviado un correo a ${email} para confirmar tu cuenta. Cuando lo confirmes, inicia sesión.`,
          action: 'resend',
        })
        setCooldown(RESEND_COOLDOWN_SECONDS)
      } else {
        saveLastEmail(email)
      }
    } catch {
      setFeedback({
        tone: 'error',
        message:
          'No se ha podido conectar con el servicio de acceso. Comprueba tu conexión e inténtalo de nuevo.',
      })
    } finally {
      setSending(false)
    }
  }

  const title =
    mode === 'login'
      ? 'Todo el viaje de tu mascota, en un solo lugar.'
      : 'Crea el espacio de tu mascota'
  const description = 'Consulta tus solicitudes, tus mascotas y cada actualización del transporte.'
  const recoveryPath = AUTH_PATHS.passwordRecovery

  return (
    <main
      className="login-screen grid-cols-[minmax(280px,490px)_minmax(320px,440px)] gap-[clamp(28px,8vw,120px)] [background:radial-gradient(circle_at_18%_20%,#f8c9cd,transparent_28%),radial-gradient(circle_at_74%_78%,#f6e3bb,transparent_31%),#fffaf8] max-[820px]:grid-cols-[minmax(0,440px)] max-[820px]:gap-[26px]"
      // Anchored to the top so switching tabs only grows the card downwards.
      style={{ alignContent: 'start', alignItems: 'start', paddingTop: 'max(24px, 9vh)' }}
    >
      <aside className="max-w-[490px] text-[#171717] max-[820px]:max-w-[440px]">
        <BrandLogo className="mb-8 h-24 w-auto object-contain max-[820px]:mb-4 max-[820px]:h-16" />
        <h2 className="my-2 mr-0 mb-4 ml-0 max-w-[440px] text-[clamp(35px,5vw,58px)] leading-[0.96] tracking-[-0.065em] max-[820px]:text-[clamp(32px,10vw,48px)]">
          Una forma tranquila de organizar tu próximo viaje.
        </h2>
        <p className="m-0 max-w-[420px] text-base leading-[1.6] text-[#555]">
          Solicita el transporte, guarda los datos de tus mascotas y recibe todas las
          actualizaciones en un único lugar.
        </p>
        <div className="mt-8 grid gap-2.5">
          <Benefit icon={PawPrint} text="Una o varias mascotas por solicitud" />
          <Benefit icon={CheckCircle2} text="Seguimiento privado de cada transporte" />
        </div>
      </aside>
      <Card className="w-full max-w-110 py-0 shadow-[0_28px_70px_rgb(101_35_40_/_14%)]">
        <CardContent className="grid gap-6 p-6 sm:p-9">
          <Tabs
            selectedKey={mode}
            onSelectionChange={(key) => changeMode(key as 'login' | 'signup')}
          >
            <TabsList aria-label="Acceso" className="w-full">
              <TabsTrigger id="login" className="flex-1 cursor-pointer">
                Entrar
              </TabsTrigger>
              <TabsTrigger id="signup" className="flex-1 cursor-pointer">
                Crear cuenta
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid gap-3" aria-live="polite">
            <h1 className="m-0 text-[clamp(26px,5vw,34px)] leading-[1.05] font-bold tracking-[-0.045em]">
              {title}
            </h1>
            <p className="text-muted-foreground m-0 text-sm leading-6">{description}</p>
          </div>
          <form
            className="grid gap-4"
            noValidate
            onSubmit={(event) => void signIn(event)}
            aria-busy={sending}
          >
            {mode === 'signup' && (
              <Field>
                <FieldLabel htmlFor="login-name">Nombre y apellidos</FieldLabel>
                <Input
                  id="login-name"
                  className="min-h-11"
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value)
                    clearError('displayName')
                  }}
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  placeholder="Como quieres que te llamemos"
                  aria-invalid={Boolean(errors.displayName)}
                  aria-describedby={errors.displayName ? 'login-name-error' : undefined}
                />
                <FieldError id="login-name-error">{errors.displayName}</FieldError>
              </Field>
            )}
            {mode === 'signup' && (
              <Field>
                <FieldLabel htmlFor="login-phone">Teléfono</FieldLabel>
                <Input
                  id="login-phone"
                  className="min-h-11"
                  type="tel"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value)
                    clearError('phone')
                  }}
                  autoComplete="tel"
                  inputMode="tel"
                  enterKeyHint="next"
                  placeholder="Para avisarte sobre el transporte"
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? 'login-phone-error' : undefined}
                />
                <FieldError id="login-phone-error">{errors.phone}</FieldError>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="login-email">Correo electrónico</FieldLabel>
              <Input
                id="login-email"
                className="min-h-11"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  clearError('email')
                }}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="email"
                enterKeyHint="next"
                placeholder="tu@email.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
              />
              <FieldError id="login-email-error">{errors.email}</FieldError>
            </Field>
            <Field>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="login-password">Contraseña</FieldLabel>
                {mode === 'login' && (
                  <a
                    className="text-muted-foreground hover:text-accent text-[13px] font-[650] underline-offset-[3px] hover:underline"
                    href={recoveryPath}
                  >
                    ¿Has olvidado tu contraseña?
                  </a>
                )}
              </div>
              <PasswordInput
                id="login-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  clearError('password')
                }}
                onKeyDown={(event) => setCapsLock(event.getModifierState('CapsLock'))}
                onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))}
                onBlur={() => setCapsLock(false)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                enterKeyHint="go"
                placeholder={mode === 'signup' ? 'Al menos 8 caracteres' : 'Tu contraseña'}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  [errors.password ? 'login-password-error' : '', 'login-password-help']
                    .filter(Boolean)
                    .join(' ') || undefined
                }
              />
              <FieldError id="login-password-error">{errors.password}</FieldError>
              <FieldDescription id="login-password-help">
                {mode === 'signup' && (
                  <>
                    <span
                      className={
                        password.length >= MIN_PASSWORD ? 'font-semibold text-green-700' : ''
                      }
                    >
                      {Math.min(password.length, MIN_PASSWORD)}/{MIN_PASSWORD} caracteres.
                    </span>{' '}
                    Tus datos solo se usarán para gestionar tus transportes.
                  </>
                )}
                {capsLock && <span className="block font-semibold">Bloq Mayús está activado.</span>}
              </FieldDescription>
            </Field>
            {feedback && (
              <Alert
                variant={
                  feedback.tone === 'error'
                    ? 'destructive'
                    : feedback.tone === 'success'
                      ? 'success'
                      : 'info'
                }
                role={feedback.tone === 'error' ? 'alert' : 'status'}
              >
                <AlertDescription>{feedback.message}</AlertDescription>
                {feedback.action === 'login' && (
                  <AlertAction>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        changeMode('login')
                        setPassword('')
                        setFeedback({
                          tone: 'info',
                          message: 'Introduce tu contraseña para entrar con este correo.',
                        })
                      }}
                    >
                      Ir a iniciar sesión
                    </Button>
                  </AlertAction>
                )}
                {feedback.action === 'resend' && (
                  <AlertAction>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={resending || cooldown > 0}
                      onClick={() => void resend()}
                    >
                      {resending
                        ? 'Enviando…'
                        : cooldown > 0
                          ? `Reenviar en ${cooldown} s`
                          : 'Reenviar correo'}
                    </Button>
                  </AlertAction>
                )}
              </Alert>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={sending}>
              {sending ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Crear mi cuenta'}
            </Button>
          </form>
          <LinkButton variant="outline" className="w-full" href={AUTH_PATHS.publicTransportRequest}>
            Solicitar un transporte sin cuenta
          </LinkButton>
        </CardContent>
      </Card>
    </main>
  )
}

function Benefit({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="flex items-center gap-2 text-sm font-[650] text-[#3c3c3c]">
      <Icon className="text-[#b51e27]" size={15} /> {text}
    </span>
  )
}
