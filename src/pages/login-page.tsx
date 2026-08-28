import { Button } from '@/components/ui/button'
import { CheckCircle2, PawPrint, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { BrandLogo } from '../components/brand-logo'
import { supabase } from '../lib/supabase'

type Props = { audience: 'client' | 'staff' }

export function LoginPage({ audience }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setError('El acceso no está configurado en este entorno.')
      return
    }
    setSending(true)
    setError('')
    try {
      const response =
        mode === 'login'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  display_name: displayName,
                  ...(audience === 'client' ? { phone, account_type: 'user' } : {}),
                },
              },
            })
      if (response.error) setError(authErrorMessage(response.error.message, mode))
      else if (mode === 'signup' && !response.data.session) {
        setMode('login')
        setError('No se ha iniciado la sesión automáticamente. Prueba a entrar con tus datos.')
      }
    } catch {
      setError('No se ha podido conectar con el servicio de acceso. Inténtalo de nuevo.')
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
        <form onSubmit={signIn}>
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
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
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
            setError('')
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

function authErrorMessage(message: string, mode: 'login' | 'signup') {
  if (/too many requests|rate limit/i.test(message)) {
    return 'Se han realizado demasiados intentos. Espera unos minutos antes de volver a intentarlo.'
  }
  return mode === 'login'
    ? 'No hemos podido iniciar sesión. Revisa tus datos.'
    : 'No hemos podido crear el acceso. Revisa los datos e inténtalo de nuevo.'
}

function Benefit({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span>
      <Icon size={15} /> {text}
    </span>
  )
}
