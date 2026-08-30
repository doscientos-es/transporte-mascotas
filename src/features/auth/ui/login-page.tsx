import { Button } from '@doscientos/ui'
import { CheckCircle2, PawPrint, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { BrandLogo } from '@/shared/ui/brand-logo'

import { getAuthFeedback, type AuthFeedback } from '../application/auth-feedback'
import { authenticate } from '../application/authenticate'

type Props = { audience: 'client' | 'staff' }

export function LoginPage({ audience }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null)
  const [sending, setSending] = useState(false)

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setFeedback(null)
    try {
      const response = await authenticate({ audience, displayName, email, mode, password, phone })
      if (response.unavailable) {
        setFeedback({ tone: 'error', message: 'El acceso no está configurado en este entorno.' })
      } else if (response.error) {
        setFeedback(getAuthFeedback(response.error, mode))
      } else if (mode === 'signup' && !response.hasSession) {
        setMode('login')
        setPassword('')
        setFeedback({
          tone: 'success',
          message:
            'Te hemos enviado un correo para confirmar tu cuenta. Cuando lo confirmes, inicia sesión.',
        })
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

  const isClient = audience === 'client'
  const title =
    mode === 'login'
      ? isClient
        ? 'Todo el viaje de tu mascota, en un solo lugar.'
        : 'Acceso a operaciones'
      : isClient
        ? 'Crea el espacio de tu mascota'
        : 'Crea tu acceso de transportista'
  const description = isClient
    ? 'Consulta tus solicitudes, tus mascotas y cada actualización del transporte.'
    : 'Accede a las rutas y tareas que tengas asignadas.'

  return (
    <main className={`login-screen login-screen-${audience}`}>
      {isClient && (
        <aside className="client-login-showcase">
          <BrandLogo />
          <p className="eyebrow">Kache envíos</p>
          <h2>Una forma tranquila de organizar su próximo viaje.</h2>
          <p>
            Solicita el transporte, guarda los datos de tus mascotas y recibe todas las
            actualizaciones en un único lugar.
          </p>
          <div>
            <Benefit icon={PawPrint} text="Una o varias mascotas por solicitud" />
            <Benefit icon={CheckCircle2} text="Seguimiento privado de cada transporte" />
          </div>
        </aside>
      )}
      <section className="login-card">
        <BrandLogo />
        <p className="eyebrow">{isClient ? 'Área de cliente' : 'Área profesional'}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <form onSubmit={(event) => void signIn(event)}>
          {mode === 'signup' && (
            <label>
              Nombre y apellidos
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="name"
                placeholder="Como quieres que te llamemos"
                required
              />
            </label>
          )}
          {mode === 'signup' && isClient && (
            <label>
              Teléfono
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                inputMode="tel"
                placeholder="Para avisarte sobre el transporte"
                required
              />
            </label>
          )}
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
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              placeholder={mode === 'signup' ? 'Al menos 8 caracteres' : undefined}
              required
            />
          </label>
          {mode === 'signup' && (
            <p className="password-help">
              Usa al menos 8 caracteres.{' '}
              {isClient
                ? 'Tus datos solo se usarán para gestionar tus transportes.'
                : 'Tu cuenta verá únicamente las rutas que se te asignen.'}
            </p>
          )}
          {feedback && (
            <div
              className={`form-feedback form-feedback-${feedback.tone}`}
              role={feedback.tone === 'error' ? 'alert' : 'status'}
            >
              <p>{feedback.message}</p>
              {feedback.action === 'login' && (
                <button
                  type="button"
                  className="form-feedback-action"
                  onClick={() => {
                    setMode('login')
                    setPassword('')
                    setFeedback({
                      tone: 'info',
                      message: 'Introduce tu contraseña para entrar con este correo.',
                    })
                  }}
                >
                  Ir a iniciar sesión
                </button>
              )}
            </div>
          )}
          <Button type="submit" disabled={sending}>
            {sending ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Crear mi cuenta'}
          </Button>
        </form>
        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setFeedback(null)
          }}
        >
          {mode === 'login'
            ? '¿Es tu primera vez? Crea tu cuenta'
            : 'Ya tengo una cuenta, quiero entrar'}
        </button>
        <a className="auth-audience-link" href={isClient ? '/admin' : '/cliente/acceso'}>
          {isClient
            ? '¿Trabajas con nosotros? Acceso profesional'
            : '¿Eres cliente? Accede a tu área personal'}
        </a>
      </section>
    </main>
  )
}

function Benefit({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span>
      <Icon size={15} /> {text}
    </span>
  )
}
