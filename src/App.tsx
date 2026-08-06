import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowUpRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, FilePlus2,
  FileText, GitFork, MapPin,
  PackageOpen, PawPrint,
  Phone, Plus, Printer, Route, Search,
  ShieldCheck, Truck, Upload, UsersRound, X
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import brandLogo from './assets/kache-logo.png'
import { ClientsPage } from './components/clients-page'
import { parseCartaPdf } from './lib/carta-parser'
import { createClient, deleteClient, loadClientInvoices, loadClients, persistInvoice, updateClient } from './lib/clients'
import { initialClientInvoices, initialDailyRoutes, initialLetters, templates } from './lib/data'
import { saveImportedLetter } from './lib/letters'
import { downloadInvoice, downloadVanManifest } from './lib/pdf'
import { loadOrSeedRouteTemplates, saveDailyRoute } from './lib/routes'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Client, ClientInvoice, DailyRoute, Letter, NavSection, RouteTemplate, ServiceAction } from './lib/types'
import { boxesBySize, boxGridSpan, boxSize, vanLanes } from './lib/van'

const nav = [
  ['cartas', 'Cartas de porte', FileText], ['plantillas', 'Rutas preestablecidas', GitFork],
  ['rutas', 'Rutas', Route], ['furgoneta', 'Furgoneta', Truck], ['clientes', 'Clientes', UsersRound],
] as const

const labelStatus: Record<string, string> = { pendiente: 'Pendiente', revisada: 'Revisada', en_ruta: 'En ruta', entregada: 'Entregada', borrador: 'Borrador', activa: 'Activa', completada: 'Completada', incidencia: 'Incidencia' }

function demoClients(letters: Letter[]): Client[] {
  const names = new Map<string, Pick<Client, 'fullName' | 'phone'>>()
  letters.forEach((letter) => [[letter.sender, letter.senderPhone], [letter.recipient, letter.recipientPhone]].forEach(([fullName, phone]) => {
    const key = fullName.trim().toLocaleLowerCase(); if (key) names.set(key, { fullName, phone })
  }))
  return [...names.entries()].map(([key, client]) => ({ id: `demo-${key}`, ...client, nif: '', email: '', address: '', city: '', postalCode: '', createdAt: new Date().toISOString() }))
}

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
  const [routeTemplates, setRouteTemplates] = useState<RouteTemplate[]>(templates)
  const [dailyRoutes, setDailyRoutes] = useState<DailyRoute[]>(initialDailyRoutes)
  const [clients, setClients] = useState<Client[]>(() => demoClients(initialLetters))
  const [invoices, setInvoices] = useState<ClientInvoice[]>(initialClientInvoices)
  const [selectedTemplate, setSelectedTemplate] = useState<RouteTemplate>(templates[0])
  const [selectedRoute, setSelectedRoute] = useState<DailyRoute>(initialDailyRoutes[0])
  const [showImport, setShowImport] = useState(false)
  const [showNewRoute, setShowNewRoute] = useState(false)
  const [invoiceLetter, setInvoiceLetter] = useState<Letter | null>(null)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const activeTemplate = routeTemplates.find((template) => template.id === selectedRoute.templateId) ?? routeTemplates[0]
  const filteredLetters = useMemo(() => letters.filter((letter) => Object.values(letter).join(' ').toLowerCase().includes(search.toLowerCase())), [letters, search])
  const assignments = useMemo(() => selectedRoute.actions.filter((action) => action.type === 'recogida' && action.box).map((action) => ({ box: action.box!, label: action.letterId })), [selectedRoute])

  useEffect(() => {
    if (!session) return
    loadOrSeedRouteTemplates(templates).then((loaded) => {
      setRouteTemplates(loaded)
      setSelectedTemplate((current) => loaded.find((template) => template.name === current.name) ?? loaded[0])
      const namesByDemoRoute: Record<string, string> = { 'route-2026-08-08': 'Mediterráneo', 'route-2026-08-09': 'Norte', 'route-2026-08-10': 'Andalucía' }
      const hydrateRoute = (route: DailyRoute): DailyRoute => ({ ...route, templateId: loaded.find((template) => template.name === namesByDemoRoute[route.id])?.id ?? route.templateId })
      setDailyRoutes((current) => current.map(hydrateRoute))
      setSelectedRoute((current) => hydrateRoute(current))
    }).catch(() => undefined)
    Promise.all([loadClients(), loadClientInvoices()]).then(([storedClients, storedInvoices]) => {
      setClients(storedClients); setInvoices(storedInvoices)
    }).catch(() => toast('No se ha podido cargar el historial de clientes.'))
  }, [session])

  function toast(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 3200) }
  async function updateAction(actionId: string) {
    const target = selectedRoute.actions.find((action) => action.id === actionId)
    const status = target?.status === 'completada' ? 'pendiente' : 'completada'
    if (session && supabase && target) {
      const { error } = await supabase.rpc('record_route_action', { p_action_id: actionId, p_status: status })
      if (error) { toast('No se ha podido actualizar la acción en la ruta.'); return }
    }
    const update = (route: DailyRoute): DailyRoute => route.id === selectedRoute.id ? { ...route, actions: route.actions.map((action): ServiceAction => action.id === actionId ? { ...action, status: action.status === 'completada' ? 'pendiente' : 'completada' } : action) } : route
    const next = update(selectedRoute); setSelectedRoute(next); setDailyRoutes((current) => current.map(update))
  }
  async function importPdf(file?: File) {
    if (!file) return
    try {
      const extracted = await parseCartaPdf(file)
      const fallbackNumber = 445 + letters.length
      const route = routeTemplates.find((template) => template.stops.some((stop) => stop.locality.toLocaleLowerCase().includes((extracted.destination ?? '').toLocaleLowerCase())))
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
  async function createDailyRoute(template: RouteTemplate, date: string) {
    const usedBoxes = new Set<number>()
    const actions = letters.filter((letter) => letter.route === template.name && letter.serviceDate === date).flatMap((letter) => letter.animals.flatMap((animal) => {
      const box = animal.box ?? boxesBySize[animal.size].find((candidate) => !usedBoxes.has(candidate))
      if (box) usedBoxes.add(box)
      const originStop = template.stops.find((stop) => stop.locality.toLocaleLowerCase().includes(letter.origin.toLocaleLowerCase()))
      const destinationStop = template.stops.find((stop) => stop.locality.toLocaleLowerCase().includes(letter.destination.toLocaleLowerCase()))
      return [
        ...(originStop ? [{ id: crypto.randomUUID(), letterId: letter.id, animalId: animal.id, type: 'recogida' as const, stop: originStop.locality, customer: letter.sender, phone: letter.senderPhone, status: 'pendiente' as const, box }] : []),
        ...(destinationStop ? [{ id: crypto.randomUUID(), letterId: letter.id, animalId: animal.id, type: 'entrega' as const, stop: destinationStop.locality, customer: letter.recipient, phone: letter.recipientPhone, status: 'pendiente' as const, box }] : []),
      ]
    }))
    const route: DailyRoute = { id: crypto.randomUUID(), templateId: template.id, date, status: 'borrador', actions }
    try {
      if (session) await saveDailyRoute(route, template, session.user.id)
      setDailyRoutes((current) => [route, ...current]); setSelectedRoute(route); setShowNewRoute(false); setSection('rutas'); toast(`Ruta ${template.name} creada como borrador.`)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se ha podido guardar la ruta.')
    }
  }
  async function saveClient(client: Client | Omit<Client, 'id' | 'createdAt'>) {
    try {
      if ('id' in client) {
        const saved = session ? await updateClient(client) : client
        setClients((current) => current.map((item) => item.id === saved.id ? saved : item)); toast('Cliente actualizado.')
      } else {
        const local = { ...client, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
        const saved = session ? await createClient(client) : local
        setClients((current) => [...current, saved].sort((a, b) => a.fullName.localeCompare(b.fullName))); toast('Cliente creado.')
      }
    } catch (error) { toast(error instanceof Error ? error.message : 'No se ha podido guardar el cliente.'); throw error }
  }
  async function removeClient(client: Client) {
    try { if (session) await deleteClient(client.id); setClients((current) => current.filter((item) => item.id !== client.id)); toast('Cliente eliminado.') }
    catch (error) { toast(error instanceof Error ? error.message : 'No se ha podido eliminar el cliente.'); throw error }
  }
  async function generateInvoice(letter: Letter, payer: 'remitente' | 'destinatario', total: number) {
    const fullName = payer === 'remitente' ? letter.sender : letter.recipient
    const phone = payer === 'remitente' ? letter.senderPhone : letter.recipientPhone
    let client = clients.find((item) => item.fullName.trim().toLocaleLowerCase() === fullName.trim().toLocaleLowerCase())
    if (!client) {
      client = { id: crypto.randomUUID(), fullName, phone, nif: '', email: '', address: '', city: '', postalCode: '', createdAt: new Date().toISOString() }
      setClients((current) => [...current, client!].sort((a, b) => a.fullName.localeCompare(b.fullName)))
    }
    const duplicate = invoices.some((invoice) => invoice.letterId === letter.id)
    if (!duplicate) setInvoices((current) => [{ id: crypto.randomUUID(), letterId: letter.id, clientId: client!.id, payer, concept: 'Servicio de transporte de mascota', total, status: 'generado', createdAt: new Date().toISOString() }, ...current])
    if (session) {
      try {
        const stored = await persistInvoice(letter, payer, total, session.user.id)
        if (stored) {
          setClients((current) => [...current.filter((item) => item.id !== client!.id && item.id !== stored.client.id), stored.client].sort((a, b) => a.fullName.localeCompare(b.fullName)))
          if (stored.invoice) setInvoices((current) => [stored.invoice!, ...current.filter((item) => item.letterId !== letter.id)])
          else toast('La factura ya estaba guardada para esta carta de porte.')
        }
      } catch { toast('La factura se ha generado, pero no se ha podido guardar en Supabase.') }
    }
    if (duplicate) toast('La factura ya existe en el historial del cliente.')
    await downloadInvoice(letter, payer, total)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand"><img src={brandLogo} alt="Kache Envíos" /><span>Transporte<br />de mascotas</span></div>
        <div className="workspace-label">OPERACIONES</div>
        <nav>{nav.map(([id, label, Icon]) => <button type="button" className={`nav-item ${section === id ? 'is-active' : ''}`} key={id} onClick={() => setSection(id)}><Icon size={18} /><span>{label}</span>{id === 'cartas' && <b>{letters.filter((letter) => letter.status === 'pendiente').length}</b>}</button>)}</nav>
        <div className="sidebar-footer">
          <div className="sidebar-profile"><span className="avatar">GM</span><div><strong>Gestor</strong><span className="role-dot"><ShieldCheck size={13} /> {session ? 'Sesión activa' : 'Modo demostración'}</span></div></div>
          <button type="button" className="help-link">Ayuda y soporte <ArrowUpRight size={14} /></button>
        </div>
      </aside>
      <main>
        <header className="topbar"><h1>{nav.find(([id]) => id === section)?.[1]}</h1></header>
        <div className="page-content">
          {section === 'cartas' && <LettersPage letters={filteredLetters} search={search} onSearchChange={setSearch} onImport={() => setShowImport(true)} onInvoice={setInvoiceLetter} />}
          {section === 'clientes' && <ClientsPage clients={clients} invoices={invoices} letters={letters} onSave={saveClient} onDelete={removeClient} />}
          {section === 'plantillas' && <TemplatesPage templates={routeTemplates} selected={selectedTemplate} onSelect={setSelectedTemplate} />}
          {section === 'rutas' && <RoutesPage route={selectedRoute} template={activeTemplate} templates={routeTemplates} routes={dailyRoutes} onSelect={setSelectedRoute} onAction={updateAction} onCreate={() => setShowNewRoute(true)} />}
          {section === 'furgoneta' && <VanPage route={selectedRoute} assignments={assignments} onPrint={() => downloadVanManifest(assignments, activeTemplate.name)} />}
        </div>
      </main>
      <nav className="mobile-nav" aria-label="Navegación móvil">{nav.map(([id, label, Icon]) => <button type="button" className={section === id ? 'is-active' : ''} key={id} onClick={() => setSection(id)}><Icon size={19} /><span>{label.split(' ')[0]}</span></button>)}</nav>
      {showImport && <ImportDialog onClose={() => setShowImport(false)} onPick={() => fileInput.current?.click()} />}
      {showNewRoute && <NewRouteDialog templates={routeTemplates} onClose={() => setShowNewRoute(false)} onCreate={createDailyRoute} />}
      {invoiceLetter && <InvoiceDialog letter={invoiceLetter} onClose={() => setInvoiceLetter(null)} onGenerate={generateInvoice} />}
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
      : await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: window.location.origin,
        },
      })
    setSending(false)
    if (response.error) setError(mode === 'login' ? 'No hemos podido iniciar sesión. Revisa tus datos.' : 'No hemos podido crear el acceso. Revisa los datos e inténtalo de nuevo.')
    else if (mode === 'signup' && !response.data.session) setError('Revisa tu correo y confirma el acceso antes de iniciar sesión.')
  }

  return <main className="login-screen"><section className="login-card"><img src={brandLogo} alt="doscientos" /><p className="eyebrow">Kache envíos</p><h1>Operaciones de transporte</h1><p>{mode === 'login' ? 'Accede con tu cuenta de administración o transportista.' : 'Crea una cuenta de transportista. Un administrador podrá asignarte permisos.'}</p><form onSubmit={signIn}>{mode === 'signup' && <label>Nombre<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required /></label>}<label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" disabled={sending}>{sending ? 'Procesando…' : mode === 'login' ? 'Acceder' : 'Crear acceso'}</Button></form><button type="button" className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>{mode === 'login' ? '¿No tienes cuenta? Crear acceso' : 'Ya tengo una cuenta'}</button></section></main>
}

function PageIntro({ text, children }: { text: string; children?: React.ReactNode }) { return <div className="page-intro"><p>{text}</p>{children}</div> }

function LettersPage({ letters, search, onSearchChange, onImport, onInvoice }: { letters: Letter[]; search: string; onSearchChange: (value: string) => void; onImport: () => void; onInvoice: (letter: Letter) => void }) {
  const pageSize = 8
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(letters.length / pageSize))
  const visibleLetters = letters.slice((page - 1) * pageSize, page * pageSize)
  const firstRecord = letters.length === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRecord = Math.min(page * pageSize, letters.length)

  useEffect(() => { setPage(1) }, [search])
  useEffect(() => { setPage((current) => Math.min(current, pageCount)) }, [pageCount])

  return <>
    <PageIntro text="Importa, revisa y prepara los servicios para cada ruta."><Button onClick={onImport}><Upload /> Importar carta</Button></PageIntro>
    <section className="stats-grid"><Stat label="Pendientes de revisión" value={letters.filter((letter) => letter.status === 'pendiente').length} accent="lime" /><Stat label="Programadas esta semana" value={letters.filter((letter) => letter.status !== 'pendiente').length} /><Stat label="Animales en transporte" value={letters.flatMap((letter) => letter.animals).length} /></section>
    <Card className="table-card"><CardContent><div className="table-heading"><div><h3>Últimas cartas</h3><p>{letters.length} registros</p></div><label className="search"><Search size={17} /><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar" aria-label="Buscar cartas" /></label></div>{letters.length === 0 ? <p className="empty-copy">No hay cartas que coincidan con la búsqueda.</p> : <><div className="responsive-table"><table><thead><tr><th>Referencia</th><th>Trayecto</th><th>Mascotas</th><th>Fecha</th><th>Estado</th><th aria-label="Acciones" /></tr></thead><tbody>{visibleLetters.map((letter) => <tr key={letter.id}><td><strong>{letter.id}</strong><small>Importada {letter.importedAt}</small></td><td><span className="route-cell"><b>{letter.origin}</b><ChevronRight size={14} /><b>{letter.destination}</b></span><small>{letter.route}</small></td><td><span className="pet-list"><PawPrint size={15} /> {letter.animals.map((animal) => animal.breed).join(', ')}</span><small>{letter.animals.length} animal{letter.animals.length !== 1 && 'es'}</small></td><td>{new Date(`${letter.serviceDate}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</td><td><span className={`status status-${letter.status}`}>{labelStatus[letter.status]}</span></td><td><div className="row-actions"><button type="button" title="Editar carta"><FileText size={17} /></button><button type="button" title="Generar borrador" onClick={() => onInvoice(letter)}><Printer size={17} /></button></div></td></tr>)}</tbody></table></div><div className="letter-cards">{visibleLetters.map((letter) => <article className="letter-card" key={letter.id}><div className="letter-card-heading"><div><strong>{letter.id}</strong><small>Importada {letter.importedAt}</small></div><span className={`status status-${letter.status}`}>{labelStatus[letter.status]}</span></div><div className="letter-card-route"><span>{letter.origin}</span><ChevronRight size={15} /><span>{letter.destination}</span></div><div className="letter-card-meta"><span><PawPrint size={15} /> {letter.animals.length} animal{letter.animals.length !== 1 && 'es'}</span><span>{new Date(`${letter.serviceDate}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span></div><div className="letter-card-footer"><span>{letter.route}</span><button type="button" onClick={() => onInvoice(letter)}><Printer size={16} /> Facturar</button></div></article>)}</div><Pagination page={page} pageCount={pageCount} firstRecord={firstRecord} lastRecord={lastRecord} total={letters.length} onChange={setPage} /></>}</CardContent></Card>
  </>
}

function Pagination({ page, pageCount, firstRecord, lastRecord, total, onChange }: { page: number; pageCount: number; firstRecord: number; lastRecord: number; total: number; onChange: (page: number) => void }) {
  if (pageCount <= 1) return null
  const pageNumbers = [...new Set([1, page - 1, page, page + 1, pageCount].filter((number) => number >= 1 && number <= pageCount))].sort((a, b) => a - b)
  return <nav className="pagination" aria-label="Paginación de cartas"><p>Mostrando {firstRecord}–{lastRecord} de {total}</p><div><button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Página anterior"><ChevronLeft size={17} /></button>{pageNumbers.map((number, index) => <span className="pagination-page" key={number}>{number > pageNumbers[index - 1] + 1 && <i aria-hidden="true">…</i>}<button type="button" className={number === page ? 'is-active' : ''} onClick={() => onChange(number)} aria-current={number === page ? 'page' : undefined}>{number}</button></span>)}<button type="button" onClick={() => onChange(page + 1)} disabled={page === pageCount} aria-label="Página siguiente"><ChevronRight size={17} /></button></div></nav>
}

function TemplatesPage({ templates, selected, onSelect }: { templates: RouteTemplate[]; selected: RouteTemplate; onSelect: (template: RouteTemplate) => void }) {
  return <>
    <PageIntro text="El orden de las paradas se conservará al crear una ruta diaria."><Button><Plus /> Nueva ruta</Button></PageIntro>
    <div className="template-layout"><Card className="template-list"><CardContent><h3>Plantillas</h3>{templates.map((template) => <button type="button" key={template.id} onClick={() => onSelect(template)} className={`template-row ${selected.id === template.id ? 'is-selected' : ''}`}><span className="template-dot" style={{ background: template.color }} /><span><strong>{template.name}</strong><small>{template.stops.length} paradas</small></span><ChevronRight size={16} /></button>)}</CardContent></Card><Card className="stops-card"><CardContent><div className="template-header"><div><span className="eyebrow">Plantilla activa</span><h3>Ruta {selected.name}</h3></div><Button variant="outline"><Plus /> Añadir parada</Button></div><ol className="stops-list">{selected.stops.map((stop, index) => <li key={stop.id}><div className="stop-index">{index + 1}</div><div><strong>{stop.locality}</strong><p>{stop.place}</p></div><span className="duration">{stop.minutes ? `${stop.minutes} min` : 'Final'}</span><a href={stop.mapUrl} target="_blank" rel="noreferrer" aria-label={`Abrir ${stop.locality} en mapas`}><MapPin size={17} /></a></li>)}</ol></CardContent></Card></div>
  </>
}

function RoutesPage({ route, template, templates, routes, onSelect, onAction, onCreate }: { route: DailyRoute; template: RouteTemplate; templates: RouteTemplate[]; routes: DailyRoute[]; onSelect: (route: DailyRoute) => void; onAction: (id: string) => void; onCreate: () => void }) {
  return <>
    <PageIntro text="La ruta incluye todas las paradas de la plantilla y los servicios del día."><Button onClick={onCreate}><CalendarDays /> Crear ruta</Button></PageIntro>
    <div className="route-selector">{routes.map((item) => <button type="button" onClick={() => onSelect(item)} className={route.id === item.id ? 'is-selected' : ''} key={item.id}><Route size={16} /><span>{templates.find((template) => template.id === item.templateId)?.name}</span><b>{new Date(`${item.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</b><span className={`status status-${item.status}`}>{labelStatus[item.status]}</span></button>)}</div>
    <Card className="route-journey"><CardContent><div className="journey-header"><div><span className="eyebrow">{route.date}</span><h3>Ruta {template.name}</h3></div><span className="status status-activa">{labelStatus[route.status]}</span></div><ol>{template.stops.map((stop, index) => { const actions = route.actions.filter((action) => action.stop === stop.locality); return <li key={`${stop.id}-${index}`}><div className="journey-node">{index + 1}</div><div className="journey-stop"><div className="journey-place"><div><h4>{stop.locality}</h4><p>{stop.place}</p></div><a href={stop.mapUrl} target="_blank" rel="noreferrer"><MapPin size={18} /> Abrir mapa</a></div>{actions.length > 0 && <div className="services">{actions.map((action) => <ServiceCard key={action.id} action={action} onToggle={() => onAction(action.id)} />)}</div>}</div></li> })}</ol></CardContent></Card>
  </>
}

function ServiceCard({ action, onToggle }: { action: ServiceAction; onToggle: () => void }) { const done = action.status === 'completada'; return <div className={`service-card ${done ? 'is-done' : ''}`}><div className="service-icon">{action.type === 'recogida' ? <PackageOpen size={18} /> : <PawPrint size={18} />}</div><div><span>{action.type === 'recogida' ? 'Recogida' : 'Entrega'} · Box {action.box}</span><strong>{action.customer}</strong><a href={`tel:${action.phone.replaceAll(' ', '')}`}><Phone size={13} /> {action.phone}</a></div><Button variant={done ? 'outline' : 'default'} size="sm" onClick={onToggle}>{done ? 'Deshacer' : action.type === 'recogida' ? 'Recogido' : 'Entregado'}</Button></div> }

function VanPage({ route, assignments, onPrint }: { route: DailyRoute; assignments: Array<{ box: number; label: string }>; onPrint: () => void }) {
  const leftLanes = vanLanes.filter((lane) => lane.side === 'left'); const rightLanes = vanLanes.filter((lane) => lane.side === 'right'); const renderLane = (lane: typeof vanLanes[number]) => <div className={`van-lane ${lane.id}`} key={lane.id}>{lane.boxes.map((box) => { const assignment = assignments.find((entry) => entry.box === box); return <button type="button" style={{ gridRow: `span ${boxGridSpan[lane.size]}` }} title={assignment ? assignment.label : `Box ${box} libre`} key={box} className={`van-box box-${boxSize(box)} ${assignment ? 'is-occupied' : ''}`}><b>{box}</b>{assignment && <span>{assignment.label.replace('CARTA DE PORTE Nº ', '#')}</span>}</button> })}</div>; return <>
    <PageIntro text="Ocupación actual por tramo. Los boxes se liberan después de cada entrega."><Button onClick={onPrint}><Printer /> Imprimir tramo</Button></PageIntro>
    <div className="van-legend"><span><i className="box-large" /> Grandes 1–4, 37–40</span><span><i className="box-medium" /> Medianos 5–12, 41–48</span><span><i className="box-small" /> Pequeños 13–36, 49–72</span></div>
    <Card className="van-card"><CardContent><div className="van-title">F U R G Ó N</div><div className="van-plan"><div className="van-front">PARTE DELANTERA (CONDUCTORES)</div><div className="van-banks van-banks-left">{leftLanes.map(renderLane)}</div><div className="van-aisle">P A S I L L O</div><div className="van-banks van-banks-right">{rightLanes.map(renderLane)}</div></div></CardContent></Card>
    <section className="assignments"><h3>Asignaciones activas</h3>{route.actions.filter((action) => action.box).map((action) => <div key={action.id}><span className={`box-chip box-${boxSize(action.box!)}`}>{action.box}</span><div><strong>{action.letterId}</strong><p>{action.type === 'recogida' ? 'Recogida' : 'Entrega'} · {action.stop}</p></div><span className={`status status-${action.status}`}>{labelStatus[action.status]}</span></div>)}</section>
  </>
}

function ImportDialog({ onClose, onPick }: { onClose: () => void; onPick: () => void }) { return <div className="dialog-backdrop" role="presentation"><Card className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="import-title"><CardContent><button type="button" className="close-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button><div className="dialog-icon"><FilePlus2 size={24} /></div><h2 id="import-title">Importar carta de porte</h2><p>Sube un PDF digital. Extraeremos el contenido y podrás revisarlo antes de guardarlo.</p><button type="button" className="dropzone" onClick={onPick}><Upload size={24} /><strong>Seleccionar PDF</strong><span>Máximo 10 MB · solo PDF con texto</span></button><p className="hint">El identificador será el encabezado «CARTA DE PORTE Nº …».</p></CardContent></Card></div> }
function InvoiceDialog({ letter, onClose, onGenerate }: { letter: Letter; onClose: () => void; onGenerate: (letter: Letter, payer: 'remitente' | 'destinatario', total: number) => Promise<void> }) { const [payer, setPayer] = useState<'remitente' | 'destinatario'>('remitente'); const [total, setTotal] = useState('200'); const [generating, setGenerating] = useState(false); return <div className="dialog-backdrop" role="presentation"><Card className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="invoice-title"><CardContent><button type="button" className="close-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button><div className="dialog-icon"><Printer size={24} /></div><h2 id="invoice-title">Preparar factura</h2><p>Elige quién paga y ajusta el importe con IVA antes de generar la factura. Se guardará automáticamente en su ficha de cliente.</p><div className="payer-options"><button type="button" className={payer === 'remitente' ? 'is-selected' : ''} onClick={() => setPayer('remitente')}><span>Remitente</span><strong>{letter.sender}</strong></button><button type="button" className={payer === 'destinatario' ? 'is-selected' : ''} onClick={() => setPayer('destinatario')}><span>Destinatario</span><strong>{letter.recipient}</strong></button></div><label className="date-field">Total (IVA incluido)<input type="number" min="0" step="0.01" value={total} onChange={(event) => setTotal(event.target.value)} /></label><Button className="dialog-submit" disabled={generating} onClick={() => { setGenerating(true); onGenerate(letter, payer, Number(total) || 0).finally(() => { setGenerating(false); onClose() }) }}><Printer /> {generating ? 'Generando…' : 'Generar factura'}</Button></CardContent></Card></div> }
function NewRouteDialog({ templates, onClose, onCreate }: { templates: RouteTemplate[]; onClose: () => void; onCreate: (template: RouteTemplate, date: string) => void }) { const [date, setDate] = useState('2026-08-09'); return <div className="dialog-backdrop" role="presentation"><Card className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="route-title"><CardContent><button type="button" className="close-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button><div className="dialog-icon"><Route size={24} /></div><h2 id="route-title">Crear ruta diaria</h2><p>Se copiarán todas las paradas y se añadirán las recogidas y entregas compatibles con la fecha elegida.</p><label className="date-field">Fecha de servicio<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><div className="dialog-options">{templates.map((template) => <button type="button" key={template.id} onClick={() => onCreate(template, date)}><span className="template-dot" style={{ background: template.color }} /><span><strong>{template.name}</strong><small>{template.stops.length} paradas</small></span><ChevronRight size={17} /></button>)}</div></CardContent></Card></div> }
function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) { return <Card className={`stat ${accent ? `stat-${accent}` : ''}`}><CardContent><p>{label}</p><strong>{value}</strong><span><ClipboardList size={15} /> actualizado ahora</span></CardContent></Card> }

export default App
