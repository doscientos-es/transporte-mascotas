import type { Session } from '@supabase/supabase-js'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { createClient, deleteClient, loadClientInvoices, loadClients, persistInvoice, updateClient } from '../lib/clients'
import { initialClientInvoices, initialDailyRoutes, initialLetters, templates } from '../lib/data'
import { saveImportedLetter } from '../lib/letters'
import { downloadInvoice } from '../lib/pdf'
import { loadOrSeedRouteTemplates, saveDailyRoute } from '../lib/routes'
import { supabase } from '../lib/supabase'
import type { Client, ClientInvoice, DailyRoute, Letter, NavSection, RouteTemplate, ServiceAction } from '../lib/types'
import { boxesBySize } from '../lib/van'

const routeNamesByDemoId: Record<string, string> = {
  'route-2026-08-08': 'Mediterráneo',
  'route-2026-08-09': 'Norte',
  'route-2026-08-10': 'Andalucía',
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

export function useDashboard(session: Session | null) {
  const [section, setSection] = useState<NavSection>('cartas')
  const [letters, setLetters] = useState<Letter[]>(initialLetters)
  const [routeTemplates, setRouteTemplates] = useState<RouteTemplate[]>(templates)
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
  const fileInput = useRef<HTMLInputElement>(null)
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
  const assignments = useMemo(() => selectedRoute.actions
    .filter((action) => action.type === 'recogida' && action.box)
    .map((action) => ({ box: action.box!, label: action.letterId })), [selectedRoute])

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
    Promise.all([loadClients(), loadClientInvoices()]).then(([storedClients, storedInvoices]) => {
      setClients(storedClients)
      setInvoices(storedInvoices)
    }).catch(() => toast('No se ha podido cargar el historial de clientes.'))
  }, [session])

  async function signOut() {
    if (!supabase || !session) return toast('No hay una sesión autenticada que cerrar.')
    const { error } = await supabase.auth.signOut()
    if (error) toast('No se ha podido cerrar la sesión.')
  }

  async function updateAction(actionId: string) {
    const target = selectedRoute.actions.find((action) => action.id === actionId)
    const status = target?.status === 'completada' ? 'pendiente' : 'completada'
    if (session && supabase && target) {
      const { error } = await supabase.rpc('record_route_action', { p_action_id: actionId, p_status: status })
      if (error) return toast('No se ha podido actualizar la acción en la ruta.')
    }
    const update = (route: DailyRoute): DailyRoute => route.id === selectedRoute.id
      ? { ...route, actions: route.actions.map((action): ServiceAction => action.id === actionId ? { ...action, status: action.status === 'completada' ? 'pendiente' : 'completada' } : action) }
      : route
    setSelectedRoute(update(selectedRoute))
    setDailyRoutes((current) => current.map(update))
  }

  async function importPdf(file?: File) {
    if (!file) return
    try {
      const { parseCartaPdf } = await import('../lib/carta-parser')
      const extracted = await parseCartaPdf(file)
      const route = routeTemplates.find((template) => template.stops.some((stop) => stop.locality.toLocaleLowerCase().includes((extracted.destination ?? '').toLocaleLowerCase())))
      const letter: Letter = {
        id: extracted.id || `CARTA DE PORTE Nº 2026-${445 + letters.length}`,
        sender: extracted.sender || 'Pendiente de revisar', senderPhone: extracted.senderPhone || '',
        recipient: extracted.recipient || 'Pendiente de revisar', recipientPhone: extracted.recipientPhone || '',
        origin: extracted.origin || 'Sin asignar', destination: extracted.destination || 'Sin asignar',
        route: route?.name ?? 'Sin asignar', serviceDate: '2026-08-08', status: 'pendiente',
        importedAt: extracted.importedAt ?? new Date().toLocaleString('es-ES'), animals: extracted.animals ?? [],
      }
      if (letters.some((item) => item.id === letter.id)) throw new Error('Ya existe una carta con este identificador.')
      if (session) await saveImportedLetter(letter, file, session.user.id)
      setLetters((current) => [letter, ...current])
      setShowImport(false)
      toast(`${file.name} importado. Revisa los campos extraídos.`)
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
      setDailyRoutes((current) => [route, ...current])
      setSelectedRoute(route)
      setShowNewRoute(false)
      setSection('rutas')
      toast(`Ruta ${template.name} creada como borrador.`)
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

  async function generateInvoice(letter: Letter, payer: 'remitente' | 'destinatario', total: number) {
    const fullName = payer === 'remitente' ? letter.sender : letter.recipient
    const phone = payer === 'remitente' ? letter.senderPhone : letter.recipientPhone
    let client = clients.find((item) => item.fullName.trim().toLocaleLowerCase() === fullName.trim().toLocaleLowerCase())
    if (!client) {
      client = { id: crypto.randomUUID(), fullName, phone, nif: '', email: '', address: '', city: '', postalCode: '', createdAt: new Date().toISOString() }
      setClients((current) => [...current, client!].sort((a, b) => a.fullName.localeCompare(b.fullName)))
    }
    const duplicate = invoices.some((invoice) => invoice.letterId === letter.id)
    if (!duplicate) setInvoices((current) => [{ id: crypto.randomUUID(), letterId: letter.id, clientId: client.id, payer, concept: 'Servicio de transporte de mascota', total, status: 'generado', createdAt: new Date().toISOString() }, ...current])
    if (session) {
      try {
        const stored = await persistInvoice(letter, payer, total, session.user.id)
        if (stored) {
          setClients((current) => [...current.filter((item) => item.id !== client.id && item.id !== stored.client.id), stored.client].sort((a, b) => a.fullName.localeCompare(b.fullName)))
          const storedInvoice = stored.invoice
          if (storedInvoice) setInvoices((current) => [storedInvoice, ...current.filter((item) => item.letterId !== letter.id)])
          else toast('La factura ya estaba guardada para esta carta de porte.')
        }
      } catch {
        toast('La factura se ha generado, pero no se ha podido guardar en Supabase.')
      }
    }
    if (duplicate) toast('La factura ya existe en el historial del cliente.')
    await downloadInvoice(letter, payer, total)
  }

  return {
    section, setSection, letters, routeTemplates, dailyRoutes, clients, invoices, selectedTemplate,
    setSelectedTemplate, selectedRoute, setSelectedRoute, activeTemplate, filteredLetters, assignments,
    search, setSearch, showImport, setShowImport, showNewRoute, setShowNewRoute, invoiceLetter,
    setInvoiceLetter, notice, fileInput, signOut, updateAction, importPdf, createDailyRoute, saveClient,
    removeClient, generateInvoice,
  }
}
