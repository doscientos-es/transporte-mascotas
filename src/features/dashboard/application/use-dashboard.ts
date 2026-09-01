import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useRef, useState } from 'react'

import { DEFAULT_STOP_DWELL_MINUTES } from '@/shared/constants/route-defaults'
import { requireSupabase, supabase } from '@/shared/infrastructure/supabase'
import type {
  Animal,
  AppRole,
  Client,
  ClientInvoice,
  DailyRoute,
  DailyRouteStop,
  InvoiceClientInput,
  InvoicePayer,
  Letter,
  LetterDraft,
  ManualPaymentMethod,
  PaymentDelivery,
  RouteDirection,
  RouteTemplate,
  ServiceAction,
  Transporter,
} from '@/shared/types'

import {
  confirmManualInvoicePayment,
  createClient,
  deleteClient,
  persistInvoice,
  updateClient,
} from '../infrastructure/clients'
import { loadLetters, saveManualLetter, updateLetter } from '../infrastructure/letters'
import {
  addDailyRouteStop,
  addRouteTemplateStop,
  appendLetterToDailyRoute,
  deleteDailyRouteStop,
  deleteRouteTemplate,
  loadDailyRoutes,
  loadRouteTemplates,
  loadTransporters,
  promoteTransporterToAdmin,
  reassignVanBox,
  saveDailyRoute,
  saveRouteTemplate,
  updateDailyRouteStops,
  updateRouteTemplate,
  updateRouteTemplateStopOrder,
} from '../infrastructure/routes'
import { sizeForMeasurements } from './animal-size'
import { calculateDrivingTimes, findBestStopInsertion } from './driving-times'
import { findForwardRouteSegment } from './route-segment'
import { assignmentsForRoute, boxesBySize } from './van'

function copyTemplateStops(
  template: RouteTemplate,
  direction: RouteDirection = 'normal',
): DailyRouteStop[] {
  const stops = template.stops.map((stop) => ({
    ...stop,
    kind: 'parada' as const,
    dwellMinutes: DEFAULT_STOP_DWELL_MINUTES,
  }))
  return direction === 'inversa' ? stops.toReversed() : stops
}

function stopsForRoute(route: DailyRoute, templates: RouteTemplate[]) {
  if (route.stops) return route.stops
  const template = templates.find((item) => item.id === route.templateId)
  if (!template) throw new Error('No se ha encontrado la plantilla de la ruta.')
  return copyTemplateStops(template)
}

function linkActionsToStops(actions: ServiceAction[], stops: DailyRouteStop[]): ServiceAction[] {
  return actions.map((action) =>
    action.stopId
      ? action
      : { ...action, stopId: stops.find((stop) => stop.locality === action.stop)?.id },
  )
}

const sizeRank = { pequeno: 0, mediano: 1, grande: 2 } as const

function largestAnimal(animals: Animal[]) {
  return animals.reduce((largest, animal) =>
    sizeRank[animal.size] > sizeRank[largest.size] ? animal : largest,
  )
}

function contactInvoiceInput(
  draft: LetterDraft,
  person: 'sender' | 'recipient',
): InvoiceClientInput {
  const prefix = person === 'sender' ? 'sender' : 'recipient'
  return {
    fullName: draft[prefix],
    nif: draft[`${prefix}Nif`],
    email: draft[`${prefix}Email`],
    phone: draft[`${prefix}Phone`],
    address: draft[`${prefix}Address`],
    postalCode: draft[`${prefix}PostalCode`],
    city: draft[`${prefix}City`],
  }
}

function billingClientForDraft(draft: LetterDraft) {
  return draft.billingPayer === 'manual'
    ? draft.otherPayer
    : contactInvoiceInput(draft, draft.billingPayer === 'remitente' ? 'sender' : 'recipient')
}

function selectFreeBox(animals: Animal[], usedBoxes: Set<number>) {
  if (!animals.length) return undefined
  const largestSize = largestAnimal(animals).size
  const compatibleBoxes = (['pequeno', 'mediano', 'grande'] as const)
    .filter((size) => sizeRank[size] >= sizeRank[largestSize])
    .flatMap((size) => boxesBySize[size])
  const requestedBox = animals
    .map((animal) => animal.box)
    .find(
      (box): box is number =>
        typeof box === 'number' && compatibleBoxes.includes(box) && !usedBoxes.has(box),
    )
  return requestedBox ?? compatibleBoxes.find((box) => !usedBoxes.has(box))
}

function actionsForLetter(route: DailyRoute, template: RouteTemplate, letter: Letter) {
  if (!letter.animals.length) return []
  const stops = route.stops ?? copyTemplateStops(template)
  const usedBoxes = new Set(
    route.actions.map((action) => action.box).filter((box): box is number => Boolean(box)),
  )
  const box = selectFreeBox(letter.animals, usedBoxes)
  const segment = findForwardRouteSegment(stops, letter.origin, letter.destination)
  if (!segment) return []
  const { originStop, destinationStop } = segment
  return letter.animals.flatMap((animal) => [
    ...(originStop
      ? [
          {
            id: crypto.randomUUID(),
            letterId: letter.id,
            animalId: animal.id,
            type: 'recogida' as const,
            stop: originStop.locality,
            stopId: originStop.id,
            customer: letter.sender,
            phone: letter.senderPhone,
            status: 'pendiente' as const,
            box,
          },
        ]
      : []),
    ...(destinationStop
      ? [
          {
            id: crypto.randomUUID(),
            letterId: letter.id,
            animalId: animal.id,
            type: 'entrega' as const,
            stop: destinationStop.locality,
            stopId: destinationStop.id,
            customer: letter.recipient,
            phone: letter.recipientPhone,
            status: 'pendiente' as const,
            box,
          },
        ]
      : []),
  ])
}

export function useDashboard(session: Session | null, role: AppRole) {
  const [letters, setLetters] = useState<Letter[]>([])
  const [routeTemplates, setRouteTemplates] = useState<RouteTemplate[]>([])
  const [transporters, setTransporters] = useState<Transporter[]>([])
  const [dailyRoutes, setDailyRoutes] = useState<DailyRoute[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<RouteTemplate | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<DailyRoute | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [editingLetter, setEditingLetter] = useState<Letter | null>(null)
  const [showNewRoute, setShowNewRoute] = useState(false)
  const [invoiceLetter, setInvoiceLetter] = useState<Letter | null>(null)
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<number>(0)

  const activeTemplate = selectedRoute
    ? routeTemplates.find((template) => template.id === selectedRoute.templateId)
    : undefined
  const assignments = useMemo(
    () => (selectedRoute ? assignmentsForRoute(selectedRoute) : []),
    [selectedRoute],
  )

  function toast(message: string) {
    setNotice(message)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3200)
  }

  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  useEffect(() => {
    if (!session) return
    Promise.all([loadRouteTemplates(), loadDailyRoutes()])
      .then(([loadedTemplates, loadedRoutes]) => {
        setRouteTemplates(loadedTemplates)
        setDailyRoutes(loadedRoutes)
        setSelectedTemplate(
          (current) =>
            loadedTemplates.find((template) => template.id === current?.id) ??
            loadedTemplates[0] ??
            null,
        )
        setSelectedRoute(
          (current) =>
            loadedRoutes.find((route) => route.id === current?.id) ?? loadedRoutes[0] ?? null,
        )
      })
      .catch(() => toast('No se han podido cargar las rutas asignadas.'))
    if (role === 'admin') {
      loadTransporters()
        .then(setTransporters)
        .catch(() => toast('No se ha podido cargar el equipo de transporte.'))
      loadLetters()
        .then(setLetters)
        .catch(() => toast('No se han podido cargar los datos de operaciones.'))
    }
  }, [role, session])

  async function signOut() {
    if (!supabase || !session) return toast('No hay una sesión autenticada que cerrar.')
    const { error } = await supabase.auth.signOut()
    if (error) toast('No se ha podido cerrar la sesión.')
  }

  async function promoteTransporter(transporterId: string) {
    const transporter = transporters.find((item) => item.id === transporterId)
    if (!transporter) throw new Error('No se ha encontrado el transportista seleccionado.')
    try {
      await promoteTransporterToAdmin(transporterId)
      setTransporters((current) => current.filter((item) => item.id !== transporterId))
      toast(`${transporter.displayName} ahora es administrador.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se ha podido actualizar el rol.'
      toast(message)
      throw error
    }
  }

  async function updateActions(actionIds: string[]) {
    if (!selectedRoute || !session)
      throw new Error('Inicia sesión para actualizar las acciones de ruta.')
    const actionIdSet = new Set(actionIds)
    const targets = selectedRoute.actions.filter((action) => actionIdSet.has(action.id))
    if (!targets.length) return
    const status = targets.every((action) => action.status === 'completada')
      ? 'pendiente'
      : 'completada'
    try {
      const results = await Promise.all(
        targets.map((action) =>
          requireSupabase().rpc('record_route_action', {
            p_action_id: action.id,
            p_status: status,
          }),
        ),
      )
      if (results.some(({ error }) => error))
        throw new Error('No se han podido actualizar las acciones en la ruta.')
    } catch {
      throw new Error('No se han podido actualizar las acciones en la ruta.')
    }
    const update = (route: DailyRoute): DailyRoute =>
      route.id === selectedRoute.id
        ? {
            ...route,
            actions: route.actions.map((action): ServiceAction =>
              actionIdSet.has(action.id) ? { ...action, status } : action,
            ),
          }
        : route
    setSelectedRoute(update(selectedRoute))
    setDailyRoutes((current) => current.map(update))
  }

  async function updateRouteStops(routeId: string, stops: DailyRouteStop[], recalculate = true) {
    if (!session) throw new Error('Inicia sesión para guardar las paradas.')
    let updatedStops = stops
    if (recalculate) {
      try {
        updatedStops = await calculateDrivingTimes(stops)
      } catch {
        toast(
          'No se han podido recalcular los trayectos en coche. Se conservan las duraciones anteriores.',
        )
      }
    }
    const update = (route: DailyRoute): DailyRoute => {
      if (route.id !== routeId) return route
      const existingStops = stopsForRoute(route, routeTemplates)
      const actions = linkActionsToStops(route.actions, existingStops).filter(
        (action) => !action.stopId || updatedStops.some((stop) => stop.id === action.stopId),
      )
      return { ...route, stops: updatedStops, actions }
    }
    await updateDailyRouteStops(routeId, updatedStops)
    setSelectedRoute((current) => (current ? update(current) : null))
    setDailyRoutes((current) => current.map(update))
  }

  async function suggestRouteStop(
    routeId: string,
    stop: Omit<DailyRouteStop, 'id' | 'kind' | 'mapUrl'>,
  ) {
    const route = dailyRoutes.find((item) => item.id === routeId)
    if (!route) throw new Error('No se ha encontrado la ruta seleccionada.')
    const nextStop: DailyRouteStop = {
      ...stop,
      id: crypto.randomUUID(),
      kind: 'parada',
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([[stop.street, stop.streetNumber].filter(Boolean).join(' '), stop.postalCode, stop.locality, stop.province, stop.country || 'España'].filter(Boolean).join(', '))}`,
    }
    return findBestStopInsertion(stopsForRoute(route, routeTemplates), nextStop)
  }

  async function addRouteStop(routeId: string, stops: DailyRouteStop[]) {
    if (!session) throw new Error('Inicia sesión para guardar una parada.')
    const route = dailyRoutes.find((item) => item.id === routeId)
    if (!route) throw new Error('No se ha encontrado la ruta seleccionada.')
    const existingIds = new Set(stopsForRoute(route, routeTemplates).map((stop) => stop.id))
    const nextStop = stops.find((stop) => !existingIds.has(stop.id))
    if (!nextStop) throw new Error('No se ha encontrado la nueva parada para guardar.')
    // findBestStopInsertion already calculates every consecutive leg from the
    // OSRM duration matrix, so it is safe to persist those values directly.
    const timedStops = stops
    try {
      await addDailyRouteStop(routeId, nextStop, stops.length)
      await updateDailyRouteStops(routeId, timedStops)
      const update = (item: DailyRoute): DailyRoute =>
        item.id === routeId ? { ...item, stops: timedStops } : item
      setDailyRoutes((current) => current.map(update))
      setSelectedRoute((current) => (current ? update(current) : null))
      toast(`${nextStop.locality} se ha añadido a la ruta.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se ha podido añadir la parada.'
      toast(message)
      throw error
    }
  }

  async function addLetterRouteStop(
    routeId: string,
    stop: Omit<DailyRouteStop, 'id' | 'kind' | 'mapUrl'>,
  ) {
    const route = dailyRoutes.find((item) => item.id === routeId)
    if (!route) throw new Error('No se ha encontrado la ruta seleccionada.')
    const existingStopIds = new Set(stopsForRoute(route, routeTemplates).map((item) => item.id))
    const plan = await suggestRouteStop(routeId, stop)
    const routeStop = plan.stops.find((item) => !existingStopIds.has(item.id))
    if (!routeStop) throw new Error('No se ha podido preparar la nueva parada.')
    await addRouteStop(routeId, plan.stops)
    return routeStop
  }

  async function removeRouteStop(routeId: string, stopId: string) {
    if (!session) throw new Error('Inicia sesión para guardar los cambios de la ruta.')
    const route = dailyRoutes.find((item) => item.id === routeId)
    if (!route) throw new Error('No se ha encontrado la ruta seleccionada.')
    const currentStops = stopsForRoute(route, routeTemplates)
    const actions = linkActionsToStops(route.actions, currentStops)
    if (actions.some((action) => action.stopId === stopId))
      throw new Error('No se puede eliminar una parada con recogidas o entregas asociadas.')
    const remaining = currentStops.filter((stop) => stop.id !== stopId)
    if (remaining.length === currentStops.length) throw new Error('No se ha encontrado la parada.')
    let stops = remaining
    try {
      stops = await calculateDrivingTimes(remaining)
    } catch {
      toast('La parada se eliminará, pero no se han podido recalcular los trayectos en coche.')
    }
    try {
      await deleteDailyRouteStop(routeId, stopId)
      await updateDailyRouteStops(routeId, stops)
      const update = (item: DailyRoute): DailyRoute =>
        item.id === routeId ? { ...item, stops } : item
      setDailyRoutes((current) => current.map(update))
      setSelectedRoute((current) => (current ? update(current) : null))
      toast('Parada eliminada de la ruta.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se ha podido eliminar la parada.'
      toast(message)
      throw error
    }
  }

  async function createRouteTemplate(name: string, color: string) {
    if (!session) throw new Error('Inicia sesión para crear una ruta preestablecida.')
    const trimmedName = name.trim()
    if (!trimmedName) throw new Error('Indica un nombre para la ruta.')
    if (
      routeTemplates.some(
        (template) => template.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
      )
    )
      throw new Error('Ya existe una ruta con ese nombre.')
    const template: RouteTemplate = { id: crypto.randomUUID(), name: trimmedName, color, stops: [] }
    try {
      const saved = await saveRouteTemplate(template)
      setRouteTemplates((current) =>
        [...current, saved].sort((left, right) => left.name.localeCompare(right.name)),
      )
      setSelectedTemplate(saved)
      toast(`Ruta ${saved.name} creada. Añade sus paradas para completarla.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se ha podido crear la ruta.'
      toast(message)
      throw error
    }
  }

  async function editRouteTemplate(templateId: string, name: string, color: string) {
    if (!session) throw new Error('Inicia sesión para actualizar la ruta preestablecida.')
    const template = routeTemplates.find((item) => item.id === templateId)
    if (!template) throw new Error('No se ha encontrado la ruta seleccionada.')
    const trimmedName = name.trim()
    if (!trimmedName) throw new Error('Indica un nombre para la ruta.')
    if (
      routeTemplates.some(
        (item) =>
          item.id !== templateId &&
          item.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
      )
    )
      throw new Error('Ya existe una ruta con ese nombre.')
    const updated = { ...template, name: trimmedName, color }
    try {
      await updateRouteTemplate(updated)
      setRouteTemplates((current) =>
        current
          .map((item) => (item.id === templateId ? updated : item))
          .sort((left, right) => left.name.localeCompare(right.name)),
      )
      setSelectedTemplate((current) => (current?.id === templateId ? updated : current))
      toast(`Ruta ${updated.name} actualizada.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se ha podido actualizar la ruta.'
      toast(message)
      throw error
    }
  }

  async function removeRouteTemplate(templateId: string) {
    if (!session) throw new Error('Inicia sesión para eliminar la ruta preestablecida.')
    const template = routeTemplates.find((item) => item.id === templateId)
    if (!template) throw new Error('No se ha encontrado la ruta seleccionada.')
    if (routeTemplates.length <= 1)
      throw new Error('Debes conservar al menos una ruta preestablecida.')
    const linkedRoutes = dailyRoutes.filter((route) => route.templateId === templateId)
    if (linkedRoutes.length)
      throw new Error(
        `No se puede eliminar porque se usa en ${linkedRoutes.length} ${linkedRoutes.length === 1 ? 'ruta diaria' : 'rutas diarias'}.`,
      )
    try {
      await deleteRouteTemplate(templateId)
      const remaining = routeTemplates.filter((item) => item.id !== templateId)
      setRouteTemplates(remaining)
      setSelectedTemplate((current) =>
        current?.id === templateId ? (remaining[0] ?? null) : current,
      )
      toast(`Ruta ${template.name} eliminada.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se ha podido eliminar la ruta.'
      toast(message)
      throw error
    }
  }

  async function addTemplateStop(
    templateId: string,
    values: Omit<DailyRouteStop, 'id' | 'kind' | 'mapUrl'>,
    insertionIndex?: number,
  ) {
    if (!session) throw new Error('Inicia sesión para guardar una parada.')
    const template = routeTemplates.find((item) => item.id === templateId)
    if (!template) throw new Error('No se ha encontrado la ruta seleccionada.')
    const stop = {
      ...values,
      id: crypto.randomUUID(),
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([[values.street, values.streetNumber].filter(Boolean).join(' '), values.postalCode, values.locality, values.province, values.country || 'España'].filter(Boolean).join(', '))}`,
    }
    try {
      const index = Math.max(
        0,
        Math.min(insertionIndex ?? template.stops.length, template.stops.length),
      )
      const stops = [...template.stops.slice(0, index), stop, ...template.stops.slice(index)]
      await addRouteTemplateStop(templateId, stop, 100000 + stops.length)
      await updateRouteTemplateStopOrder(templateId, stops)
      const update = (item: RouteTemplate) => (item.id === templateId ? { ...item, stops } : item)
      setRouteTemplates((current) => current.map(update))
      setSelectedTemplate((current) => (current ? update(current) : null))
      toast(`${stop.locality} se ha añadido a ${template.name} en la posición ${index + 1}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se ha podido añadir la parada.'
      toast(message)
      throw error
    }
  }

  async function reorderTemplateStops(templateId: string, stops: RouteTemplate['stops']) {
    if (!session) throw new Error('Inicia sesión para guardar el orden de las paradas.')
    const template = routeTemplates.find((item) => item.id === templateId)
    if (!template) throw new Error('No se ha encontrado la ruta seleccionada.')
    if (
      stops.length !== template.stops.length ||
      stops.some((stop, index) => stop.id !== template.stops[index]?.id) === false
    )
      return
    try {
      await updateRouteTemplateStopOrder(templateId, stops)
      const update = (item: RouteTemplate) => (item.id === templateId ? { ...item, stops } : item)
      setRouteTemplates((current) => current.map(update))
      setSelectedTemplate((current) => (current ? update(current) : null))
      toast(`Se ha actualizado el orden de ${template.name}.`)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se ha podido actualizar el orden de las paradas.'
      toast(message)
      throw error
    }
  }

  function updateRouteService(routeId: string, service: ServiceAction) {
    const update = (route: DailyRoute): DailyRoute => {
      if (route.id !== routeId) return route
      const actions = linkActionsToStops(route.actions, stopsForRoute(route, routeTemplates))
      return {
        ...route,
        actions: actions.map((action) => (action.id === service.id ? service : action)),
      }
    }
    setSelectedRoute((current) => (current ? update(current) : null))
    setDailyRoutes((current) => current.map(update))
  }

  async function reassignRouteBox(routeId: string, letterId: string, box: number) {
    if (!session) throw new Error('Inicia sesión para cambiar el box.')
    const route = dailyRoutes.find((item) => item.id === routeId)
    if (!route) throw new Error('No se ha encontrado la ruta seleccionada.')
    const currentBox = route.actions.find(
      (action) => action.letterId === letterId && action.type === 'recogida',
    )?.box
    if (currentBox === box) return

    await reassignVanBox(route, letterId, box)
    const update = (item: DailyRoute): DailyRoute =>
      item.id === routeId
        ? {
            ...item,
            actions: item.actions.map((action) =>
              action.letterId === letterId ? { ...action, box } : action,
            ),
          }
        : item
    setSelectedRoute((current) => (current ? update(current) : null))
    setDailyRoutes((current) => current.map(update))
    toast(`Box ${box} asignado a ${letterId}.`)
  }

  function removeRouteService(routeId: string, serviceId: string) {
    const update = (route: DailyRoute): DailyRoute =>
      route.id === routeId
        ? { ...route, actions: route.actions.filter((action) => action.id !== serviceId) }
        : route
    setSelectedRoute((current) => (current ? update(current) : null))
    setDailyRoutes((current) => current.map(update))
  }

  async function createLetter(draft: LetterDraft) {
    if (!session) throw new Error('Inicia sesión para crear una carta de porte.')
    try {
      const dailyRoute = dailyRoutes.find((route) => route.id === draft.routeId)
      const routeTemplate =
        dailyRoute && routeTemplates.find((template) => template.id === dailyRoute.templateId)
      if (!dailyRoute || !routeTemplate)
        throw new Error('Selecciona la ruta diaria donde se realizará el servicio.')
      const animals: Animal[] = draft.animals.map((animal) => ({
        ...animal,
        id: crypto.randomUUID(),
        breed: animal.breed.trim() || 'Sin clasificar',
        size: sizeForMeasurements(animal),
      }))
      const reference = draft.reference.trim()
      const id = reference || 'PENDIENTE'
      const letter: Letter = {
        id,
        sender: draft.sender.trim(),
        senderPhone: draft.senderPhone.trim(),
        senderEmail: draft.senderEmail.trim(),
        senderNif: draft.senderNif.trim(),
        senderAddress: draft.senderAddress.trim(),
        senderPostalCode: draft.senderPostalCode.trim(),
        senderCity: draft.senderCity.trim(),
        senderProvince: draft.senderProvince.trim(),
        recipient: draft.recipient.trim(),
        recipientPhone: draft.recipientPhone.trim(),
        recipientEmail: draft.recipientEmail.trim(),
        recipientNif: draft.recipientNif.trim(),
        recipientAddress: draft.recipientAddress.trim(),
        recipientPostalCode: draft.recipientPostalCode.trim(),
        recipientCity: draft.recipientCity.trim(),
        recipientProvince: draft.recipientProvince.trim(),
        origin: draft.origin.trim(),
        destination: draft.destination.trim(),
        originPoint: draft.originPoint.trim(),
        destinationPoint: draft.destinationPoint.trim(),
        accompanyingDocuments: draft.accompanyingDocuments,
        billingPayer: draft.billingPayer,
        billingClient: billingClientForDraft(draft),
        route: routeTemplate.name,
        serviceDate: dailyRoute.date,
        status: 'pendiente',
        importedAt: new Date().toLocaleString('es-ES'),
        animals,
      }
      const routeActions = actionsForLetter(dailyRoute, routeTemplate, letter)
      if (routeActions.length !== animals.length * 2)
        throw new Error(
          'Elige un origen anterior al destino entre las paradas de la ruta seleccionada.',
        )
      const savedId = await saveManualLetter(
        letter,
        dailyRoute,
        routeActions,
        reference,
        draft.signatureConfirmed,
      )
      const savedLetter = { ...letter, id: savedId ?? letter.id }
      const savedActions = routeActions.map((action) => ({ ...action, letterId: savedLetter.id }))
      setLetters((current) => [savedLetter, ...current])
      const updateRoute = (route: DailyRoute) =>
        route.id === dailyRoute.id
          ? { ...route, actions: [...route.actions, ...savedActions] }
          : route
      setDailyRoutes((current) => current.map(updateRoute))
      setSelectedRoute((current) => (current ? updateRoute(current) : null))
      setShowImport(false)
      toast(`Carta creada y vinculada a ${routeTemplate.name}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se ha podido crear la carta.'
      toast(message)
      throw error
    }
  }

  async function editLetter(draft: LetterDraft) {
    if (!session) throw new Error('Inicia sesión para actualizar una carta de porte.')
    const currentLetter = editingLetter
    if (!currentLetter) return
    try {
      const dailyRoute = dailyRoutes.find((route) => route.id === draft.routeId)
      const routeTemplate =
        dailyRoute && routeTemplates.find((template) => template.id === dailyRoute.templateId)
      if (!dailyRoute || !routeTemplate)
        throw new Error('Selecciona la ruta diaria donde se realizará el servicio.')
      const animals: Animal[] = draft.animals.map((animal, index) => ({
        ...animal,
        id: currentLetter.animals[index]?.id ?? crypto.randomUUID(),
        box: currentLetter.animals[index]?.box,
        breed: animal.breed.trim() || 'Sin clasificar',
        size: sizeForMeasurements(animal),
      }))
      const letter: Letter = {
        ...currentLetter,
        sender: draft.sender.trim(),
        senderPhone: draft.senderPhone.trim(),
        senderEmail: draft.senderEmail.trim(),
        senderNif: draft.senderNif.trim(),
        senderAddress: draft.senderAddress.trim(),
        senderPostalCode: draft.senderPostalCode.trim(),
        senderCity: draft.senderCity.trim(),
        senderProvince: draft.senderProvince.trim(),
        recipient: draft.recipient.trim(),
        recipientPhone: draft.recipientPhone.trim(),
        recipientEmail: draft.recipientEmail.trim(),
        recipientNif: draft.recipientNif.trim(),
        recipientAddress: draft.recipientAddress.trim(),
        recipientPostalCode: draft.recipientPostalCode.trim(),
        recipientCity: draft.recipientCity.trim(),
        recipientProvince: draft.recipientProvince.trim(),
        origin: draft.origin.trim(),
        destination: draft.destination.trim(),
        originPoint: draft.originPoint.trim(),
        destinationPoint: draft.destinationPoint.trim(),
        accompanyingDocuments: draft.accompanyingDocuments,
        billingPayer: draft.billingPayer,
        billingClient: billingClientForDraft(draft),
        route: routeTemplate.name,
        serviceDate: dailyRoute.date,
        animals,
      }
      const rebuiltActions = actionsForLetter(dailyRoute, routeTemplate, letter)
      if (rebuiltActions.length !== animals.length * 2)
        throw new Error('Elige un origen y un destino incluidos en la ruta seleccionada.')
      const previousActions = dailyRoutes
        .flatMap((route) => route.actions)
        .filter((action) => action.letterId === letter.id)
      const previousStatus = new Map(
        previousActions.map((action) => [`${action.animalId}:${action.type}`, action.status]),
      )
      const routeActions = rebuiltActions.map((action) => ({
        ...action,
        status: previousStatus.get(`${action.animalId}:${action.type}`) ?? action.status,
      }))
      const affectedRoutes = dailyRoutes.filter((route) =>
        route.actions.some((action) => action.letterId === letter.id),
      )
      await updateLetter(letter, routeTemplate.id, affectedRoutes, draft.signatureConfirmed)
      await appendLetterToDailyRoute(dailyRoute, letter, routeActions)
      setLetters((current) => current.map((item) => (item.id === letter.id ? letter : item)))
      const updateRoute = (route: DailyRoute): DailyRoute => {
        const withoutLetter = route.actions.filter((action) => action.letterId !== letter.id)
        return route.id === dailyRoute.id
          ? { ...route, actions: [...withoutLetter, ...routeActions] }
          : { ...route, actions: withoutLetter }
      }
      setDailyRoutes((current) => current.map(updateRoute))
      setSelectedRoute((current) => (current ? updateRoute(current) : null))
      setEditingLetter(null)
      toast(`Carta actualizada. Se mantiene en estado ${letter.status.replace('_', ' ')}.`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se ha podido actualizar la carta.'
      toast(message)
      throw error
    }
  }

  async function createDailyRoute(
    template: RouteTemplate,
    date: string,
    transporterId?: string,
    direction: RouteDirection = 'normal',
  ) {
    if (!session) throw new Error('Inicia sesión para crear una ruta.')
    const usedBoxes = new Set<number>()
    const actions = letters
      .filter((letter) => letter.route === template.name && letter.serviceDate === date)
      .flatMap((letter) => {
        const box = selectFreeBox(letter.animals, usedBoxes)
        if (box) usedBoxes.add(box)
        const originStop = template.stops.find((stop) =>
          stop.locality.toLocaleLowerCase().includes(letter.origin.toLocaleLowerCase()),
        )
        const destinationStop = template.stops.find((stop) =>
          stop.locality.toLocaleLowerCase().includes(letter.destination.toLocaleLowerCase()),
        )
        return letter.animals.flatMap((animal) => [
          ...(originStop
            ? [
                {
                  id: crypto.randomUUID(),
                  letterId: letter.id,
                  animalId: animal.id,
                  type: 'recogida' as const,
                  stop: originStop.locality,
                  customer: letter.sender,
                  phone: letter.senderPhone,
                  status: 'pendiente' as const,
                  box,
                },
              ]
            : []),
          ...(destinationStop
            ? [
                {
                  id: crypto.randomUUID(),
                  letterId: letter.id,
                  animalId: animal.id,
                  type: 'entrega' as const,
                  stop: destinationStop.locality,
                  customer: letter.recipient,
                  phone: letter.recipientPhone,
                  status: 'pendiente' as const,
                  box,
                },
              ]
            : []),
        ])
      })
    let stops = copyTemplateStops(template, direction)
    try {
      stops = await calculateDrivingTimes(stops)
    } catch {
      toast('No se han podido calcular los trayectos en coche al crear la ruta.')
    }
    const route: DailyRoute = {
      id: crypto.randomUUID(),
      templateId: template.id,
      date,
      status: 'borrador',
      transporterId,
      direction,
      stops,
      actions,
    }
    try {
      const savedRoute = await saveDailyRoute(route, template, session.user.id)
      setDailyRoutes((current) => [savedRoute, ...current])
      setSelectedRoute(savedRoute)
      setShowNewRoute(false)
      toast(
        `Ruta ${template.name} creada en sentido ${direction === 'inversa' ? 'inverso' : 'habitual'}.`,
      )
      return savedRoute
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se ha podido guardar la ruta.'
      toast(message)
      throw error
    }
  }

  async function saveClient(client: Client | Omit<Client, 'id' | 'createdAt'>) {
    if (!session) throw new Error('Inicia sesión para guardar un cliente.')
    try {
      if ('id' in client) {
        await updateClient(client)
        toast('Cliente actualizado.')
      } else {
        await createClient(client)
        toast('Cliente creado.')
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se ha podido guardar el cliente.')
      throw error
    }
  }

  async function removeClient(client: Client) {
    if (!session) throw new Error('Inicia sesión para eliminar un cliente.')
    try {
      await deleteClient(client.id)
      toast('Cliente eliminado.')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'No se ha podido eliminar el cliente.')
      throw error
    }
  }

  async function generateInvoice(
    letter: Letter,
    payer: InvoicePayer,
    total: number,
    clientInput: InvoiceClientInput,
    delivery?: PaymentDelivery,
  ) {
    if (!session) throw new Error('Inicia sesión para crear una solicitud de pago.')
    if (!clientInput.fullName.trim()) throw new Error('Falta el titular de la factura.')
    const stored = await persistInvoice(
      letter,
      payer,
      total,
      session.user.id,
      clientInput,
      delivery,
    )
    if (!stored) throw new Error('No se ha podido guardar la solicitud de pago.')
    const storedInvoice = stored.invoice
    if (storedInvoice) {
      if (delivery?.channel !== 'manual')
        await sendInvoiceNotification(storedInvoice, 'solicitud_pago', false)
      toast('Solicitud de pago creada. La factura se emitirá al confirmar el cobro.')
      return
    }
    toast('La solicitud ya estaba guardada para esta carta de porte.')
  }

  async function confirmManualPayment(invoice: ClientInvoice, paymentMethod: ManualPaymentMethod) {
    if (!session) throw new Error('Inicia sesión para registrar un cobro.')
    await confirmManualInvoicePayment(invoice.id, paymentMethod)
    toast('Cobro registrado y factura emitida.')
  }

  async function sendInvoiceNotification(
    invoice: ClientInvoice,
    kind: 'solicitud_pago' | 'factura_emitida' = 'solicitud_pago',
    notify = true,
  ) {
    if (!supabase || !session) throw new Error('Inicia sesión para enviar el documento.')
    const { data, error } = await supabase.functions.invoke('send-billing-notifications', {
      body: { invoiceId: invoice.id, kind },
    })
    if (error)
      throw new Error(
        kind === 'solicitud_pago'
          ? 'La solicitud se ha creado, pero no se ha podido enviar.'
          : 'No se ha podido reenviar la factura.',
      )
    const result = data as { error?: string; sent?: number } | null
    if (result?.error) throw new Error(result.error)
    if (notify)
      toast(
        `${kind === 'solicitud_pago' ? 'Solicitud' : 'Factura'} enviada por ${result?.sent === 2 ? 'email y WhatsApp' : 'el canal seleccionado'}.`,
      )
  }

  return {
    letters,
    routeTemplates,
    transporters,
    dailyRoutes,
    selectedTemplate,
    setSelectedTemplate,
    selectedRoute,
    setSelectedRoute,
    activeTemplate,
    assignments,
    showImport,
    setShowImport,
    editingLetter,
    setEditingLetter,
    showNewRoute,
    setShowNewRoute,
    invoiceLetter,
    setInvoiceLetter,
    notice,
    toast,
    signOut,
    promoteTransporter,
    updateActions,
    updateRouteStops,
    suggestRouteStop,
    addRouteStop,
    addLetterRouteStop,
    removeRouteStop,
    createRouteTemplate,
    editRouteTemplate,
    removeRouteTemplate,
    addTemplateStop,
    reorderTemplateStops,
    updateRouteService,
    reassignRouteBox,
    removeRouteService,
    createLetter,
    editLetter,
    createDailyRoute,
    saveClient,
    removeClient,
    generateInvoice,
    confirmManualPayment,
    sendInvoiceNotification,
  }
}
