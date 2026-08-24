import type { Session } from '@supabase/supabase-js'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { createClient, deleteClient, loadClientInvoices, loadClients, persistInvoice, updateClient } from '../lib/clients'
import { createManualLetter, loadLetters } from '../lib/letters'
import { downloadInvoice } from '../lib/pdf'
import { loadDailyRoutes, loadRouteTemplates, saveDailyRoute, setDailyRoutePublished } from '../lib/routes'
import { supabase } from '../lib/supabase'
import type { Client, ClientInvoice, DailyRoute, Letter, NavSection, RouteTemplate, ServiceAction } from '../lib/types'
import { boxesBySize } from '../lib/van'
import { confirmReservationPayment, loadBackofficeReservations, type BackofficeReservation } from '../lib/backoffice-reservations'

const emptyTemplate: RouteTemplate = { id: '', name: 'Sin plantilla', color: '#171717', stops: [] }
const emptyRoute: DailyRoute = { id: '', templateId: '', date: new Date().toISOString().slice(0, 10), status: 'borrador', actions: [] }

export function useDashboard(session: Session | null) {
  const [section, setSection] = useState<NavSection>('cartas')
  const [letters, setLetters] = useState<Letter[]>([])
  const [routeTemplates, setRouteTemplates] = useState<RouteTemplate[]>([])
  const [dailyRoutes, setDailyRoutes] = useState<DailyRoute[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<ClientInvoice[]>([])
  const [reservations, setReservations] = useState<BackofficeReservation[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<RouteTemplate>(emptyTemplate)
  const [selectedRoute, setSelectedRoute] = useState<DailyRoute>(emptyRoute)
  const [showLetterEditor, setShowLetterEditor] = useState(false)
  const [showNewRoute, setShowNewRoute] = useState(false)
  const [invoiceLetter, setInvoiceLetter] = useState<Letter | null>(null)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const deferredSearch = useDeferredValue(search)

  const activeTemplate = routeTemplates.find((template) => template.id === selectedRoute.templateId) ?? routeTemplates[0] ?? emptyTemplate
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
    loadRouteTemplates().then((loaded) => {
      setRouteTemplates(loaded)
      setSelectedTemplate((current) => loaded.find((template) => template.id === current.id) ?? loaded[0] ?? emptyTemplate)
    }).catch(() => undefined)
    Promise.all([loadClients(), loadClientInvoices(), loadBackofficeReservations(), loadLetters(), loadDailyRoutes()]).then(([storedClients, storedInvoices, storedReservations, storedLetters, storedRoutes]) => {
      setClients(storedClients)
      setInvoices(storedInvoices)
      setReservations(storedReservations)
      setLetters(storedLetters)
      setDailyRoutes(storedRoutes)
      setSelectedRoute(storedRoutes[0] ?? emptyRoute)
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

  async function saveManualLetter(letter: Letter) {
    try {
      if (!session) throw new Error('Inicia sesión para crear una carta.')
      await createManualLetter(letter, session.user.id)
      setLetters((current) => [letter, ...current])
      setShowLetterEditor(false)
      toast('Carta de porte creada.')
    } catch (error) { toast(error instanceof Error ? error.message : 'No se ha podido crear la carta.'); throw error }
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

  async function setRoutePublished(routeId: string, published: boolean) {
    try {
      await setDailyRoutePublished(routeId, published)
      const update = (route: DailyRoute): DailyRoute => route.id === routeId ? { ...route, published } : route
      setDailyRoutes((current) => current.map(update))
      setSelectedRoute((current) => update(current))
      toast(published ? 'Ruta publicada para reservas.' : 'Ruta retirada de reservas públicas.')
    } catch (error) { toast(error instanceof Error ? error.message : 'No se ha podido actualizar la publicación de la ruta.') }
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

  async function generateInvoice(letter: Letter, payer: 'remitente' | 'destinatario' | 'third_party', total: number, thirdParty?: { fullName: string; phone: string }) {
    const fullName = payer === 'third_party' ? thirdParty?.fullName.trim() : payer === 'remitente' ? letter.sender : letter.recipient
    const phone = payer === 'third_party' ? thirdParty?.phone.trim() ?? '' : payer === 'remitente' ? letter.senderPhone : letter.recipientPhone
    if (!fullName) return toast('Indica los datos de la persona o empresa que factura.')
    let client = clients.find((item) => item.fullName.trim().toLocaleLowerCase() === fullName.trim().toLocaleLowerCase())
    if (!client) {
      client = { id: crypto.randomUUID(), fullName, phone, nif: '', email: '', address: '', city: '', postalCode: '', createdAt: new Date().toISOString() }
      setClients((current) => [...current, client!].sort((a, b) => a.fullName.localeCompare(b.fullName)))
    }
    const activeClient = client!
    const duplicate = invoices.some((invoice) => invoice.letterId === letter.id)
    if (!duplicate) setInvoices((current) => [{ id: crypto.randomUUID(), letterId: letter.id, clientId: activeClient.id, payer, concept: 'Servicio de transporte de mascota', total, status: 'generado', createdAt: new Date().toISOString() }, ...current])
    if (session) {
      try {
        const stored = await persistInvoice(letter, payer, total, session.user.id, thirdParty)
        if (stored) {
          setClients((current) => [...current.filter((item) => item.id !== activeClient.id && item.id !== stored.client.id), stored.client].sort((a, b) => a.fullName.localeCompare(b.fullName)))
          const storedInvoice = stored.invoice
          if (storedInvoice) setInvoices((current) => [storedInvoice, ...current.filter((item) => item.letterId !== letter.id)])
          else toast('La factura ya estaba guardada para esta carta de porte.')
        }
      } catch {
        toast('La factura se ha generado, pero no se ha podido guardar en Supabase.')
      }
    }
    if (duplicate) toast('La factura ya existe en el historial del cliente.')
    await downloadInvoice(letter, payer, total, thirdParty)
  }

  async function markReservationPaid(id: string) {
    try {
      await confirmReservationPayment(id)
      setReservations((current) => current.map((item) => item.id === id ? { ...item, status: 'confirmed', paymentStatus: 'paid' } : item))
      toast('Cobro confirmado. Documentación generada y comunicaciones enviadas.')
    } catch (error) { toast(error instanceof Error ? error.message : 'No se ha podido confirmar el cobro.') }
  }

  return {
    section, setSection, letters, routeTemplates, dailyRoutes, clients, invoices, reservations, selectedTemplate,
    setSelectedTemplate, selectedRoute, setSelectedRoute, activeTemplate, filteredLetters, assignments,
    search, setSearch, showLetterEditor, setShowLetterEditor, showNewRoute, setShowNewRoute, invoiceLetter,
    setInvoiceLetter, notice, signOut, updateAction, createDailyRoute, saveClient,
    removeClient, generateInvoice, markReservationPaid, saveManualLetter, setRoutePublished,
  }
}
