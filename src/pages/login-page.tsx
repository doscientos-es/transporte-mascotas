import { Button } from '@/components/ui/button'
import { useState, type FormEvent } from 'react'
import brandLogo from '../assets/kache-logo.png'
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

  return <main className="login-screen"><section className="login-card"><img src={brandLogo} alt="doscientos" /><p className="eyebrow">Kache envíos</p><h1>Operaciones de transporte</h1><p>{mode === 'login' ? 'Accede con tu cuenta de administración o transportista.' : 'Crea una cuenta de transportista. Un administrador podrá asignarte permisos.'}</p><form onSubmit={signIn}>{mode === 'signup' && <label>Nombre<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required /></label>}<label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" disabled={sending}>{sending ? 'Procesando…' : mode === 'login' ? 'Acceder' : 'Crear acceso'}</Button></form><button type="button" className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>{mode === 'login' ? '¿No tienes cuenta? Crear acceso' : 'Ya tengo una cuenta'}</button></section></main>
}