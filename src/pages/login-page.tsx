import { Button } from '@/components/ui/button'
import { CheckCircle2, PawPrint, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { BrandLogo } from '../components/brand-logo'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setSending(true)
    setError('')
    const response = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName }, emailRedirectTo: window.location.origin },
      })
    setSending(false)
    if (response.error) setError(mode === 'login' ? 'No hemos podido iniciar sesión. Revisa tus datos.' : 'No hemos podido crear el acceso. Revisa los datos e inténtalo de nuevo.')
    else if (mode === 'signup' && !response.data.session) setError('Revisa tu correo y confirma el acceso antes de iniciar sesión.')
  }

  return <main className="login-screen"><section className="login-card"><BrandLogo /><p className="eyebrow">Kache envíos</p><h1>{mode === 'login' ? 'Accede a tu transporte' : 'Crea tu área de cliente'}</h1><p>{mode === 'login' ? 'Consulta tus solicitudes y el estado de cada transporte.' : 'Solo necesitas tus datos de contacto para empezar a solicitar transportes.'}</p>{mode === 'signup' && <div className="signup-benefits"><Benefit icon={PawPrint} text="Pide un transporte para una o varias mascotas" /><Benefit icon={CheckCircle2} text="Consulta la confirmación y las actualizaciones" /></div>}<form onSubmit={signIn}>{mode === 'signup' && <label>Nombre y apellidos<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" placeholder="Como quieres que te llamemos" required /></label>}<label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="tu@email.com" required /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} placeholder={mode === 'signup' ? 'Al menos 8 caracteres' : undefined} required /></label>{mode === 'signup' && <p className="password-help">Usa al menos 8 caracteres. Podrás iniciar sesión en cuanto creemos tu acceso.</p>}{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" disabled={sending}>{sending ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Crear mi cuenta'}</Button></form><button type="button" className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>{mode === 'login' ? '¿Es tu primera vez? Crea tu cuenta' : 'Ya tengo una cuenta, quiero entrar'}</button></section></main>
}

function Benefit({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return <span><Icon size={15} /> {text}</span>
}
