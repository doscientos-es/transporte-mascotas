import type { Session } from '@supabase/supabase-js'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { createClient, deleteClient, loadClientInvoices, loadClients, loadTransporterInvoices, persistInvoice, updateClient } from '../lib/clients'
import { initialClientInvoices, initialDailyRoutes, initialLetters, templates } from '../lib/data'
import { saveManualLetter } from '../lib/letters'
import { appendLetterToDailyRoute, loadDailyRoutes, loadOrSeedRouteTemplates, loadTransporters, saveDailyRoute, updateDailyRouteStops } from '../lib/routes'
import { supabase } from '../lib/supabase'
import type { Animal, AppRole, Client, ClientInvoice, DailyRoute, DailyRouteStop, InvoiceClientInput, InvoicePayer, Letter, LetterDraft, PaymentDelivery, RouteDirection, RouteTemplate, ServiceAction, Transporter } from '../lib/types'
import { boxesBySize } from '../lib/van'

const routeNamesByDemoId: Record<string, string> = {
  'route-2026-08-08': 'Mediterráneo',
  'route-2026-08-09': 'Norte',
  'route-2026-08-10': 'Andalucía',
}

function copyTemplateStops(template: RouteTemplate, direction: RouteDirection = 'normal'): DailyRouteStop[] {
  const stops = template.stops.map((stop) => ({ ...stop, kind: 'parada' as const, dwellMinutes: 15 }))
  return direction === 'inversa' ? stops.toReversed() : stops
}

function stopsForRoute(route: DailyRoute, templates: RouteTemplate[]) {
  return route.stops ?? copyTemplateStops(templates.find((template) => template.id === route.templateId) ?? templates[0])
}

function linkActionsToStops(actions: ServiceAction[], stops: DailyRouteStop[]): ServiceAction[] {
  return actions.map((action) => action.stopId ? action : { ...action, stopId: stops.find((stop) => stop.locality === action.stop)?.id })
}

const sizeRank = { pequeno: 0, mediano: 1, grande: 2 } as const

function largestAnimal(animals: Animal[]) {
  return animals.reduce((largest, animal) => sizeRank[animal.size] > sizeRank[largest.size] ? animal : largest)
}

function actionsForLetter(route: DailyRoute, template: RouteTemplate, letter: Letter) {
  if (!letter.animals.length) return []
  const stops = route.stops ?? copyTemplateStops(template)
  const usedBoxes = new Set(route.actions.map((action) => action.box).filter((box): box is number => Boolean(box)))
  const representative = largestAnimal(letter.animals)
  const requestedBox = letter.animals.find((animal) => animal.box && !usedBoxes.has(animal.box))?.box
  const box = requestedBox ?? boxesBySize[representative.size].find((candidate) => !usedBoxes.has(candidate))
  const originStop = stops.find((stop) => stop.locality.toLocaleLowerCase().includes(letter.origin.toLocaleLowerCase()))
  const destinationStop = stops.find((stop) => stop.locality.toLocaleLowerCase().includes(letter.destination.toLocaleLowerCase()))
  return letter.animals.flatMap((animal) => [
    ...(originStop ? [{ id: crypto.randomUUID(), letterId: letter.id, animalId: animal.id, type: 'recogida' as const, stop: originStop.locality, stopId: originStop.id, customer: letter.sender, phone: letter.senderPhone, status: 'pendiente' as const, box }] : []),
    ...(destinationStop ? [{ id: crypto.randomUUID(), letterId: letter.id, animalId: animal.id, type: 'entrega' as const, stop: destinationStop.locality, stopId: destinationStop.id, customer: letter.recipient, phone: letter.recipientPhone, status: 'pendiente' as const, box }] : []),
  ])
}

function createDemoClients(letters: Letter[]): Client[] {
  const names = new Map<string, Pick<Client, 'fullName' | 'phone'>>()
  letters.forEach((letter) => [[letter.sender, letter.senderPhone], [letter.recipient, letter.recipientPhone]].forEach(([fullName, phone]) => {
    const key = fullName.trim().toLocaleLowerCase()
    if (key) names.set(key, { fullName, phone })
  }))
  return [...names.entries()].map(([key, client]) => ({
    id: `demo-${key}`,
    ...client,
    nif: '', email: '', address: '', city: '', postalCode: '',
    createdAt: new Date().toISOString(),
  }))
}

export function useDashboard(session: Session | null, role: AppRole) {
  const [letters, setLetters] = useState<Letter[]>(initialLetters)
  const [routeTemplates, setRouteTemplates] = useState<RouteTemplate[]>(templates)
  const [transporters, setTransporters] = useState<Transporter[]>([])
  const [dailyRoutes, setDailyRoutes] = useState<DailyRoute[]>(initialDailyRoutes)
  const [clients, setClients] = useState<Client[]>(() => createDemoClients(initialLetters))
  const [invoices, setInvoices] = useState<ClientInvoice[]>(initialClientInvoices)
  const [selectedTemplate, setSelectedTemplate] = useState<RouteTemplate>(templates[0])
  const [selectedRoute, setSelectedRoute] = useState<DailyRoute>(initialDailyRoutes[0])
  const [showImport, setShowImport] = useState(false)
  const [showNewRoute, setShowNewRoute] = useState(false)
  const [invoiceLetter, setInvoiceLetter] = useState<Letter | null>(null)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const deferredSearch = useDeferredValue(search)

  const activeTemplate = routeTemplates.find((template) => template.id === selectedRoute.templateId) ?? routeTemplates[0]
  const filteredLetters = useMemo(() => {
    const term = deferredSearch.trim().toLocaleLowerCase()
    if (!term) return letters
    return letters.filter((letter) => [
      letter.id, letter.sender, letter.senderPhone, letter.recipient, letter.recipientPhone,
      letter.origin, letter.destination, letter.route, letter.serviceDate, letter.status,
      ...letter.animals.map((animal) => animal.breed),
    ].join(' ').toLocaleLowerCase().includes(term))
  }, [letters, deferredSearch])
  const assignments = useMemo(() => {
    const byLetterAndBox = new Map<string, { box: number; label: string; animalCount: number }>()
    selectedRoute.actions.filter((action) => action.type === 'recogida' && action.box).forEach((action) => {
      const key = `${action.letterId}:${action.box}`
      const current = byLetterAndBox.get(key)
      byLetterAndBox.set(key, current ? { ...current, animalCount: current.animalCount + 1 } : { box: action.box!, label: action.letterId, animalCount: 1 })
    })
    return [...byLetterAndBox.values()]
  }, [selectedRoute])

  function toast(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3200)
  }

  useEffect(() => {
    if (!session) return
    loadOrSeedRouteTemplates(templates).then((loaded) => {
      setRouteTemplates(loaded)
      setSelectedTemplate((current) => loaded.find((template) => template.name === current.name) ?? loaded[0])
      const hydrateRoute = (route: DailyRoute): DailyRoute => ({
        ...route,
        templateId: loaded.find((template) => template.name === routeNamesByDemoId[route.id])?.id ?? route.templateId,
      })
      setDailyRoutes((current) => current.map(hydrateRoute))
      setSelectedRoute((current) => hydrateRoute(current))
    }).catch(() => undefined)
    loadDailyRoutes().then((loaded) => {
      setDailyRoutes(loaded)
      if (loaded[0]) setSelectedRoute(loaded[0])
    }).catch(() => toast('No se han podido cargar las rutas asignadas.'))
    if (role === 'admin') {
      loadTransporters().then(setTransporters).catch(() => toast('No se ha podido cargar el equipo de transporte.'))
      Promise.all([loadClients(), loadClientInvoices()]).then(([storedClients, storedInvoices]) => {
        setClients(storedClients)
        setInvoices(storedInvoices)
      }).catch(() => toast('No se ha podido cargar el historial de clientes.'))
    } else {
      loadTransporterInvoices().then(setInvoices).catch(() => toast('No se han podido cargar las facturas asignadas.'))
    }
  }, [role, session])

  async function signOut() {
    if (!supabase || !session) return toast('No hay una sesión autenticada que cerrar.')
    const { error } = await supabase.auth.signOut()
    if (error) toast('No se ha podido cerrar la sesión.')
  }

  async function updateActions(actionIds: string[]) {
    const actionIdSet = new Set(actionIds)
    const targets = selectedRoute.actions.filter((action) => actionIdSet.has(action.id))
    if (!targets.length) return
    const status = targets.every((action) => action.status === 'completada') ? 'pendiente' : 'completada'
    if (session && supabase) {
      const database = supabase
      const results = await Promise.all(targets.map((action) => database.rpc('record_route_action', { p_action_id: action.id, p_status: status })))
      if (results.some(({ error }) => error)) return toast('No se han podido actualizar las acciones en la ruta.')
    }
    const update = (route: DailyRoute): DailyRoute => route.id === selectedRoute.id
      ? { ...route, actions: route.actions.map((action): ServiceAction => actionIdSet.has(action.id) ? { ...action, status } : action) }
      : route
    setSelectedRoute(update(selectedRoute))
    setDailyRoutes((current) => current.map(update))
  }

  function updateRouteStops(routeId: string, stops: DailyRouteStop[]) {
    const update = (route: DailyRoute): DailyRoute => {
      if (route.id !== routeId) return route
      const existingStops = stopsForRoute(route, routeTemplates)
      const actions = linkActionsToStops(route.actions, existingStops).filter((action) => !action.stopId || stops.some((stop) => stop.id === action.stopId))
      return { ...route, stops, actions }
    }
    setSelectedRoute((current) => update(current))
    setDailyRoutes((current) => current.map(update))
    if (session) updateDailyRouteStops(routeId, stops).catch(() => toast('No se han podido guardar los cambios de las paradas.'))
  }

  function updateRouteService(routeId: string, service: ServiceAction) {
    const update = (route: DailyRoute): DailyRoute => {
      if (route.id !== routeId) return route
      const actions = linkActionsToStops(route.actions, stopsForRoute(route, routeTemplates))
      return { ...route, actions: actions.map((action) => action.id === service.id ? service : action) }
    }
    setSelectedRoute((current) => update(current))
    setDailyRoutes((current) => current.map(update))
  }

  function removeRouteService(routeId: string, serviceId: string) {
    const update = (route: DailyRoute): DailyRoute => route.id === routeId
      ? { ...route, actions: route.actions.filter((action) => action.id !== serviceId) }
      : route
    setSelectedRoute((current) => update(current))
    setDailyRoutes((current) => current.map(update))
  }

  async function createLetter(draft: LetterDraft) {
    try {
      const dailyRoute = dailyRoutes.find((route) => route.id === draft.routeId)
      const routeTemplate = dailyRoute && routeTemplates.find((template) => template.id === dailyRoute.templateId)
      if (!dailyRoute || !routeTemplate) throw new Error('Selecciona la ruta diaria donde se realizará el servicio.')
      const animals: Animal[] = draft.animals.map((animal) => ({ ...animal, id: crypto.randomUUID(), breed: animal.breed.trim() || 'Sin clasificar' }))
      const reference = draft.reference.trim()
      const id = reference
        ? (reference.toLocaleUpperCase('es-ES').startsWith('CARTA DE PORTE Nº') ? reference : `CARTA DE PORTE Nº ${reference}`)
        : `CARTA DE PORTE Nº 2026-${445 + letters.length}`
      const letter: Letter = {
        id,
        sender: draft.sender.trim(), senderPhone: draft.senderPhone.trim(),
        recipient: draft.recipient.trim(), recipientPhone: draft.recipientPhone.trim(),
        origin: draft.origin.trim(), destination: draft.destination.trim(),
        route: routeTemplate.name, serviceDate: dailyRoute.date, status: 'pendiente',
        importedAt: new Date().toLocaleString('es-ES'), animals,
      }
      if (letters.some((item) => item.id === letter.id)) throw new Error('Ya existe una carta con este identificador.')
      const routeActions = actionsForLetter(dailyRoute, routeTemplate, letter)
      if (routeActions.length !== animals.length * 2) throw new Error('Elige un origen y un destino incluidos en la ruta seleccionada.')
      if (session) await saveManualLetter(letter, routeTemplate.id, session.user.id)
      if (session) await appendLetterToDailyRoute(dailyRoute, letter, routeActions)
      setLetters((current) => [letter, ...current])
      const updateRoute = (route: DailyRoute) => route.id === dailyRoute.id ? { ...route, actions: [...route.actions, ...routeActions] } : route
      setDailyRoutes((current) => current.map(updateRoute))
      setSelectedRoute((current) => updateRoute(current))
      setShowImport(false)
      toast(`Carta creada y vinculada a ${routeTemplate.name}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se ha podido crear la carta.'
      toast(message)
      throw error
    }
  }

  async function createDailyRoute(template: RouteTemplate, date: string, transporterId?: string, direction: RouteDirection = 'normal') {
    const usedBoxes = new Set<number>()
    const actions = letters.filter((letter) => letter.route === template.name && letter.serviceDate === date).flatMap((letter) => {
      const representative = largestAnimal(letter.animals)
      const requestedBox = letter.animals.find((animal) => animal.box && !usedBoxes.has(animal.box))?.box
      const box = requestedBox ?? boxesBySize[representative.size].find((candidate) => !usedBoxes.has(candidate))
      if (box) usedBoxes.add(box)
      const originStop = template.stops.find((stop) => stop.locality.toLocaleLowerCase().includes(letter.origin.toLocaleLowerCase()))
      const destinationStop = template.stops.find((stop) => stop.locality.toLocaleLowerCase().includes(letter.destination.toLocaleLowerCase()))
      return letter.animals.flatMap((animal) => [
        ...(originStop ? [{ id: crypto.randomUUID(), letterId: letter.id, animalId: animal.id, type: 'recogida' as const, stop: originStop.locality, customer: letter.sender, phone: letter.senderPhone, status: 'pendiente' as const, box }] : []),
        ...(destinationStop ? [{ id: crypto.randomUUID(), letterId: letter.id, animalId: animal.id, type: 'entrega' as const, stop: destinationStop.locality, customer: letter.recipient, phone: letter.recipientPhone, status: 'pendiente' as const, box }] : []),
      ])
    })
    const route: DailyRoute = { id: crypto.randomUUID(), templateId: template.id, date, status: 'borrador', transporterId, direction, stops: copyTemplateStops(template, direction), actions }
    try {
      const savedRoute = session ? await saveDailyRoute(route, template, session.user.id) : route
      setDailyRoutes((current) => [savedRoute, ...current])
      setSelectedRoute(savedRoute)
      setShowNewRoute(false)
      toast(`Ruta ${template.name} creada en sentido ${direction === 'inversa' ? 'inverso' : 'habitual'}.`)
      return savedRoute
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se ha podido guardar la ruta.')
    }
  }

  async function saveClient(client: Client | Omit<Client, 'id' | 'createdAt'>) {
    try {
      if ('id' in client) {
        const saved = session ? await updateClient(client) : client
        setClients((current) => current.map((item) => item.id === saved.id ? saved : item))
        toast('Cliente actualizado.')
      } else {
        const local = { ...client, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
        const saved = session ? await createClient(client) : local
        setClients((current) => [...current, saved].sort((a, b) => a.fullName.localeCompare(b.fullName)))
        toast('Cliente creado.')
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se ha podido guardar el cliente.')
      throw error
    }
  }

  async function removeClient(client: Client) {
    try {
      if (session) await deleteClient(client.id)
      setClients((current) => current.filter((item) => item.id !== client.id))
      toast('Cliente eliminado.')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se ha podido eliminar el cliente.')
      throw error
    }
  }

  async function generateInvoice(letter: Letter, payer: InvoicePayer, total: number, manualClient?: InvoiceClientInput, delivery?: PaymentDelivery) {
    const clientInput = payer === 'manual'
      ? manualClient
      : { fullName: payer === 'remitente' ? letter.sender : letter.recipient, phone: payer === 'remitente' ? letter.senderPhone : letter.recipientPhone, nif: '', email: '', address: '', city: '', postalCode: '' }
    if (!clientInput?.fullName.trim()) throw new Error('Falta el titular de la factura.')
    const fullName = clientInput.fullName.trim()
    let client = clients.find((item) => item.fullName.trim().toLocaleLowerCase() === fullName.toLocaleLowerCase())
    if (!client) {
      client = { id: crypto.randomUUID(), ...clientInput, fullName, createdAt: new Date().toISOString() }
      setClients((current) => [...current, client!].sort((a, b) => a.fullName.localeCompare(b.fullName)))
    } else if (payer === 'manual') {
      client = { ...client, ...clientInput, fullName }
      setClients((current) => current.map((item) => item.id === client!.id ? client! : item))
    }
    const duplicate = invoices.some((invoice) => invoice.letterId === letter.id)
    if (!duplicate) setInvoices((current) => [{ id: crypto.randomUUID(), letterId: letter.id, clientId: client.id, payer, concept: 'Servicio de transporte de mascota', total, status: 'solicitud_pago', createdAt: new Date().toISOString() }, ...current])
    if (session) {
      const stored = await persistInvoice(letter, payer, total, session.user.id, clientInput, delivery)
      if (stored) {
        setClients((current) => [...current.filter((item) => item.id !== client.id && item.id !== stored.client.id), stored.client].sort((a, b) => a.fullName.localeCompare(b.fullName)))
        const storedInvoice = stored.invoice
        if (storedInvoice) {
          setInvoices((current) => [storedInvoice, ...current.filter((item) => item.letterId !== letter.id)])
          await sendInvoiceNotification(storedInvoice, 'solicitud_pago', false)
        } else toast('La solicitud ya estaba guardada para esta carta de porte.')
      }
    }
    if (duplicate) toast('La factura ya existe en el historial del cliente.')
    toast('Solicitud de pago creada. La factura se emitirá al confirmar el cobro.')
  }

  async function sendInvoiceNotification(invoice: ClientInvoice, kind: 'solicitud_pago' | 'factura_emitida' = 'solicitud_pago', notify = true) {
    if (!supabase || !session) throw new Error('Inicia sesión para enviar el documento.')
    const { data, error } = await supabase.functions.invoke('send-billing-notifications', { body: { invoiceId: invoice.id, kind } })
    if (error) throw new Error(kind === 'solicitud_pago' ? 'La solicitud se ha creado, pero no se ha podido enviar.' : 'No se ha podido reenviar la factura.')
    const result = data as { error?: string; sent?: number } | null
    if (result?.error) throw new Error(result.error)
    if (notify) toast(`${kind === 'solicitud_pago' ? 'Solicitud' : 'Factura'} enviada por ${result?.sent === 2 ? 'email y WhatsApp' : 'el canal seleccionado'}.`)
  }

  return {
    letters, routeTemplates, transporters, dailyRoutes, clients, invoices, selectedTemplate,
    setSelectedTemplate, selectedRoute, setSelectedRoute, activeTemplate, filteredLetters, assignments,
    search, setSearch, showImport, setShowImport, showNewRoute, setShowNewRoute, invoiceLetter,
    setInvoiceLetter, notice, signOut, updateActions, updateRouteStops, updateRouteService, removeRouteService, createLetter, createDailyRoute, saveClient,
    removeClient, generateInvoice, sendInvoiceNotification,
  }
}
