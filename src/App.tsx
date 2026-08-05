import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowUpRight, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, FilePlus2,
  FileText, GitFork, MapPin, Menu, MoreHorizontal, PackageOpen, PawPrint,
  Phone, Plus, Printer, Route, Search, ShieldCheck, Truck, Upload, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { initialDailyRoutes, initialLetters, templates } from './lib/data'
import { parseCartaPdf } from './lib/carta-parser'
import { saveImportedLetter } from './lib/letters'
import { downloadInvoice, downloadVanManifest } from './lib/pdf'
import { boxSize } from './lib/van'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { DailyRoute, Letter, NavSection, RouteTemplate, ServiceAction } from './lib/types'
import './App.css'

const brandLogo = 'https://hnzyllbksqvamqfubhri.supabase.co/storage/v1/object/public/brand-assets/logo/3f8bbbcd-c9da-47df-ad20-f801d397610a/logo.png'
const nav = [
  ['cartas', 'Cartas de porte', FileText], ['plantillas', 'Rutas preestablecidas', GitFork],
  ['rutas', 'Rutas', Route], ['furgoneta', 'Furgoneta', Truck],
] as const

const labelStatus: Record<string, string> = { pendiente: 'Pendiente', revisada: 'Revisada', en_ruta: 'En ruta', entregada: 'Entregada', borrador: 'Borrador', activa: 'Activa', completada: 'Completada', incidencia: 'Incidencia' }

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => subscription.subscription.unsubscribe()
  }, [])

  if (!ready) return <div className="loading-screen">Cargando sesión segura…</div>
  if (isSupabaseConfigured && !session) return <LoginScreen />
  return <Dashboard session={session} />
}

function Dashboard({ session }: { session: Session | null }) {
  const [section, setSection] = useState<NavSection>('cartas')
  const [letters, setLetters] = useState<Letter[]>(initialLetters)
  const [dailyRoutes, setDailyRoutes] = useState<DailyRoute[]>(initialDailyRoutes)
  const [selectedTemplate, setSelectedTemplate] = useState<RouteTemplate>(templates[0])
  const [selectedRoute, setSelectedRoute] = useState<DailyRoute>(initialDailyRoutes[0])
  const [showImport, setShowImport] = useState(false)
  const [showNewRoute, setShowNewRoute] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const activeTemplate = templates.find((template) => template.id === selectedRoute.templateId) ?? templates[0]
  const filteredLetters = useMemo(() => letters.filter((letter) => Object.values(letter).join(' ').toLowerCase().includes(search.toLowerCase())), [letters, search])
  const assignments = useMemo(() => selectedRoute.actions.filter((action) => action.type === 'recogida' && action.box).map((action) => ({ box: action.box!, label: action.letterId })), [selectedRoute])

  function toast(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 3200) }
  function updateAction(actionId: string) {
    const update = (route: DailyRoute): DailyRoute => route.id === selectedRoute.id ? { ...route, actions: route.actions.map((action): ServiceAction => action.id === actionId ? { ...action, status: action.status === 'completada' ? 'pendiente' : 'completada' } : action) } : route
    const next = update(selectedRoute); setSelectedRoute(next); setDailyRoutes((current) => current.map(update))
  }
  async function importPdf(file?: File) {
    if (!file) return
    try {
      const extracted = await parseCartaPdf(file)
      const fallbackNumber = 445 + letters.length
      const route = templates.find((template) => template.stops.some((stop) => stop.locality.toLocaleLowerCase().includes((extracted.destination ?? '').toLocaleLowerCase())))
      const letter: Letter = {
        id: extracted.id || `CARTA DE PORTE Nº 2026-${fallbackNumber}`,
        sender: extracted.sender || 'Pendiente de revisar', senderPhone: extracted.senderPhone || '',
        recipient: extracted.recipient || 'Pendiente de revisar', recipientPhone: extracted.recipientPhone || '',
        origin: extracted.origin || 'Sin asignar', destination: extracted.destination || 'Sin asignar',
        route: route?.name ?? 'Sin asignar', serviceDate: '2026-08-08', status: 'pendiente',
        importedAt: extracted.importedAt ?? new Date().toLocaleString('es-ES'), animals: extracted.animals ?? [],
      }
      if (letters.some((item) => item.id === letter.id)) throw new Error('Ya existe una carta con este identificador.')
      if (session) await saveImportedLetter(letter, file, session.user.id)
      setLetters((current) => [letter, ...current]); setShowImport(false); toast(`${file.name} importado. Revisa los campos extraídos.`)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se ha podido importar el PDF.')
    }
  }
  function createDailyRoute(template: RouteTemplate) {
    const route: DailyRoute = { id: `route-${Date.now()}`, templateId: template.id, date: '2026-08-09', status: 'borrador', actions: [] }
    setDailyRoutes((current) => [route, ...current]); setSelectedRoute(route); setShowNewRoute(false); setSection('rutas'); toast(`Ruta ${template.name} creada como borrador.`)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand"><img src={brandLogo} alt="doscientos" /><span>Transporte<br />de mascotas</span></div>
        <div className="workspace-label">OPERACIONES</div>
        <nav>{nav.map(([id, label, Icon]) => <button type="button" className={`nav-item ${section === id ? 'is-active' : ''}`} key={id} onClick={() => setSection(id)}><Icon size={18} /><span>{label}</span>{id === 'cartas' && <b>{letters.filter((letter) => letter.status === 'pendiente').length}</b>}</button>)}</nav>
        <div className="sidebar-footer"><div className="role-dot"><ShieldCheck size={17} /> {session ? 'Sesión activa' : 'Modo demostración'}</div><button type="button" className="help-link">Ayuda y soporte <ArrowUpRight size={14} /></button></div>
      </aside>
      <main>
        <header className="topbar"><div><button type="button" className="mobile-menu" aria-label="Abrir menú"><Menu size={20} /></button><p className="eyebrow">Gestión logística</p><h1>{nav.find(([id]) => id === section)?.[1]}</h1></div><div className="topbar-actions"><label className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" aria-label="Buscar" /></label><span className="avatar">GM</span></div></header>
        <div className="page-content">
          {section === 'cartas' && <LettersPage letters={filteredLetters} onImport={() => setShowImport(true)} onInvoice={(letter) => downloadInvoice(letter.id, letter.sender, 200)} />}
          {section === 'plantillas' && <TemplatesPage selected={selectedTemplate} onSelect={setSelectedTemplate} />}
          {section === 'rutas' && <RoutesPage route={selectedRoute} template={activeTemplate} routes={dailyRoutes} onSelect={setSelectedRoute} onAction={updateAction} onCreate={() => setShowNewRoute(true)} />}
          {section === 'furgoneta' && <VanPage route={selectedRoute} assignments={assignments} onPrint={() => downloadVanManifest(assignments, activeTemplate.name)} />}
        </div>
      </main>
      <nav className="mobile-nav" aria-label="Navegación móvil">{nav.map(([id, label, Icon]) => <button type="button" className={section === id ? 'is-active' : ''} key={id} onClick={() => setSection(id)}><Icon size={19} /><span>{label.split(' ')[0]}</span></button>)}</nav>
      {showImport && <ImportDialog onClose={() => setShowImport(false)} onPick={() => fileInput.current?.click()} />}
      {showNewRoute && <NewRouteDialog onClose={() => setShowNewRoute(false)} onCreate={createDailyRoute} />}
      <input ref={fileInput} hidden type="file" accept="application/pdf" onChange={(event) => importPdf(event.target.files?.[0])} />
      {notice && <div className="toast" role="status"><CheckCircle2 size={18} /> {notice}</div>}
    </div>
  )
}

function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setSending(true); setError('')
    const response = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
    setSending(false)
    if (response.error) setError(mode === 'login' ? 'No hemos podido iniciar sesión. Revisa tus datos.' : 'No hemos podido crear el acceso. Revisa los datos e inténtalo de nuevo.')
    else if (mode === 'signup' && !response.data.session) setError('Revisa tu correo y confirma el acceso antes de iniciar sesión.')
  }

  return <main className="login-screen"><section className="login-card"><img src={brandLogo} alt="doscientos" /><p className="eyebrow">Kache envíos</p><h1>Operaciones de transporte</h1><p>{mode === 'login' ? 'Accede con tu cuenta de administración o transportista.' : 'Crea una cuenta de transportista. Un administrador podrá asignarte permisos.'}</p><form onSubmit={signIn}>{mode === 'signup' && <label>Nombre<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required /></label>}<label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" disabled={sending}>{sending ? 'Procesando…' : mode === 'login' ? 'Acceder' : 'Crear acceso'}</Button></form><button type="button" className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>{mode === 'login' ? '¿No tienes cuenta? Crear acceso' : 'Ya tengo una cuenta'}</button></section></main>
}

function PageIntro({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) { return <div className="page-intro"><div><h2>{title}</h2><p>{text}</p></div>{children}</div> }

function LettersPage({ letters, onImport, onInvoice }: { letters: Letter[]; onImport: () => void; onInvoice: (letter: Letter) => void }) {
  return <>
    <PageIntro title="Cartas de porte" text="Importa, revisa y prepara los servicios para cada ruta."><Button onClick={onImport}><Upload /> Importar carta</Button></PageIntro>
    <section className="stats-grid"><Stat label="Pendientes de revisión" value={letters.filter((letter) => letter.status === 'pendiente').length} accent="lime" /><Stat label="Programadas esta semana" value={letters.filter((letter) => letter.status !== 'pendiente').length} /><Stat label="Animales en transporte" value={letters.flatMap((letter) => letter.animals).length} /></section>
    <Card className="table-card"><CardContent><div className="table-heading"><div><h3>Últimas cartas</h3><p>{letters.length} registros</p></div><button type="button" className="filter-button"><MoreHorizontal size={18} /></button></div><div className="responsive-table"><table><thead><tr><th>Referencia</th><th>Trayecto</th><th>Mascotas</th><th>Fecha</th><th>Estado</th><th aria-label="Acciones" /></tr></thead><tbody>{letters.map((letter) => <tr key={letter.id}><td><strong>{letter.id}</strong><small>Importada {letter.importedAt}</small></td><td><span className="route-cell"><b>{letter.origin}</b><ChevronRight size={14} /><b>{letter.destination}</b></span><small>{letter.route}</small></td><td><span className="pet-list"><PawPrint size={15} /> {letter.animals.map((animal) => animal.breed).join(', ')}</span><small>{letter.animals.length} animal{letter.animals.length !== 1 && 'es'}</small></td><td>{new Date(`${letter.serviceDate}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</td><td><span className={`status status-${letter.status}`}>{labelStatus[letter.status]}</span></td><td><div className="row-actions"><button type="button" title="Editar carta"><FileText size={17} /></button><button type="button" title="Generar borrador" onClick={() => onInvoice(letter)}><Printer size={17} /></button></div></td></tr>)}</tbody></table></div></CardContent></Card>
  </>
}

function TemplatesPage({ selected, onSelect }: { selected: RouteTemplate; onSelect: (template: RouteTemplate) => void }) { return <>
  <PageIntro title="Rutas preestablecidas" text="El orden de las paradas se conservará al crear una ruta diaria."><Button><Plus /> Nueva ruta</Button></PageIntro>
  <div className="template-layout"><Card className="template-list"><CardContent><h3>Plantillas</h3>{templates.map((template) => <button type="button" key={template.id} onClick={() => onSelect(template)} className={`template-row ${selected.id === template.id ? 'is-selected' : ''}`}><span className="template-dot" style={{ background: template.color }} /><span><strong>{template.name}</strong><small>{template.stops.length} paradas</small></span><ChevronRight size={16} /></button>)}</CardContent></Card><Card className="stops-card"><CardContent><div className="template-header"><div><span className="eyebrow">Plantilla activa</span><h3>Ruta {selected.name}</h3></div><Button variant="outline"><Plus /> Añadir parada</Button></div><ol className="stops-list">{selected.stops.map((stop, index) => <li key={stop.id}><div className="stop-index">{index + 1}</div><div><strong>{stop.locality}</strong><p>{stop.place}</p></div><span className="duration">{stop.minutes ? `${stop.minutes} min` : 'Final'}</span><a href={stop.mapUrl} target="_blank" rel="noreferrer" aria-label={`Abrir ${stop.locality} en mapas`}><MapPin size={17} /></a></li>)}</ol></CardContent></Card></div>
  </> }

function RoutesPage({ route, template, routes, onSelect, onAction, onCreate }: { route: DailyRoute; template: RouteTemplate; routes: DailyRoute[]; onSelect: (route: DailyRoute) => void; onAction: (id: string) => void; onCreate: () => void }) { return <>
  <PageIntro title="Rutas" text="La ruta incluye todas las paradas de la plantilla y los servicios del día."><Button onClick={onCreate}><CalendarDays /> Crear ruta</Button></PageIntro>
  <div className="route-selector">{routes.map((item) => <button type="button" onClick={() => onSelect(item)} className={route.id === item.id ? 'is-selected' : ''} key={item.id}><Route size={16} /><span>{templates.find((template) => template.id === item.templateId)?.name}</span><b>{new Date(`${item.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</b><span className={`status status-${item.status}`}>{labelStatus[item.status]}</span></button>)}</div>
  <Card className="route-journey"><CardContent><div className="journey-header"><div><span className="eyebrow">{route.date}</span><h3>Ruta {template.name}</h3></div><span className="status status-activa">{labelStatus[route.status]}</span></div><ol>{template.stops.map((stop, index) => { const actions = route.actions.filter((action) => action.stop === stop.locality); return <li key={`${stop.id}-${index}`}><div className="journey-node">{index + 1}</div><div className="journey-stop"><div className="journey-place"><div><h4>{stop.locality}</h4><p>{stop.place}</p></div><a href={stop.mapUrl} target="_blank" rel="noreferrer"><MapPin size={18} /> Abrir mapa</a></div>{actions.length > 0 && <div className="services">{actions.map((action) => <ServiceCard key={action.id} action={action} onToggle={() => onAction(action.id)} />)}</div>}</div></li> })}</ol></CardContent></Card>
  </> }

function ServiceCard({ action, onToggle }: { action: ServiceAction; onToggle: () => void }) { const done = action.status === 'completada'; return <div className={`service-card ${done ? 'is-done' : ''}`}><div className="service-icon">{action.type === 'recogida' ? <PackageOpen size={18} /> : <PawPrint size={18} />}</div><div><span>{action.type === 'recogida' ? 'Recogida' : 'Entrega'} · Box {action.box}</span><strong>{action.customer}</strong><a href={`tel:${action.phone.replaceAll(' ', '')}`}><Phone size={13} /> {action.phone}</a></div><Button variant={done ? 'outline' : 'default'} size="sm" onClick={onToggle}>{done ? 'Deshacer' : action.type === 'recogida' ? 'Recogido' : 'Entregado'}</Button></div> }

function VanPage({ route, assignments, onPrint }: { route: DailyRoute; assignments: Array<{ box: number; label: string }>; onPrint: () => void }) { return <>
  <PageIntro title="Furgoneta" text="Ocupación actual por tramo. Los boxes se liberan después de cada entrega."><Button onClick={onPrint}><Printer /> Imprimir tramo</Button></PageIntro>
  <div className="van-legend"><span><i className="box-large" /> Grandes 1–4, 37–40</span><span><i className="box-medium" /> Medianos 5–12, 41–48</span><span><i className="box-small" /> Pequeños 13–36, 49–72</span></div>
  <Card className="van-card"><CardContent><div className="van-front">PARTE DELANTERA · CONDUCTORES</div><div className="van-grid">{Array.from({ length: 72 }, (_, index) => index + 1).map((box) => { const assignment = assignments.find((entry) => entry.box === box); return <button type="button" title={assignment ? assignment.label : `Box ${box} libre`} key={box} className={`van-box box-${boxSize(box)} ${assignment ? 'is-occupied' : ''}`}><b>{box}</b>{assignment && <span>{assignment.label.replace('CARTA DE PORTE Nº ', '#')}</span>}</button> })}</div><div className="van-aisle">PASILLO</div></CardContent></Card>
  <section className="assignments"><h3>Asignaciones activas</h3>{route.actions.filter((action) => action.box).map((action) => <div key={action.id}><span className={`box-chip box-${boxSize(action.box!)}`}>{action.box}</span><div><strong>{action.letterId}</strong><p>{action.type === 'recogida' ? 'Recogida' : 'Entrega'} · {action.stop}</p></div><span className={`status status-${action.status}`}>{labelStatus[action.status]}</span></div>)}</section>
  </> }

function ImportDialog({ onClose, onPick }: { onClose: () => void; onPick: () => void }) { return <div className="dialog-backdrop" role="presentation"><Card className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="import-title"><CardContent><button type="button" className="close-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button><div className="dialog-icon"><FilePlus2 size={24} /></div><h2 id="import-title">Importar carta de porte</h2><p>Sube un PDF digital. Extraeremos el contenido y podrás revisarlo antes de guardarlo.</p><button type="button" className="dropzone" onClick={onPick}><Upload size={24} /><strong>Seleccionar PDF</strong><span>Máximo 10 MB · solo PDF con texto</span></button><p className="hint">El identificador será el encabezado «CARTA DE PORTE Nº …».</p></CardContent></Card></div> }
function NewRouteDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (template: RouteTemplate) => void }) { return <div className="dialog-backdrop" role="presentation"><Card className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="route-title"><CardContent><button type="button" className="close-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button><div className="dialog-icon"><Route size={24} /></div><h2 id="route-title">Crear ruta diaria</h2><p>Elige una plantilla para el día 9 de agosto. Se copiarán todas sus paradas y las cartas compatibles.</p><div className="dialog-options">{templates.map((template) => <button type="button" key={template.id} onClick={() => onCreate(template)}><span className="template-dot" style={{ background: template.color }} /><span><strong>{template.name}</strong><small>{template.stops.length} paradas</small></span><ChevronRight size={17} /></button>)}</div></CardContent></Card></div> }
function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) { return <Card className={`stat ${accent ? `stat-${accent}` : ''}`}><CardContent><p>{label}</p><strong>{value}</strong><span><ClipboardList size={15} /> actualizado ahora</span></CardContent></Card> }

export default App
