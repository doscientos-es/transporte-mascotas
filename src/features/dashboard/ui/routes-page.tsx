import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  Input,
} from '@doscientos/ui'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Clock3,
  Lock,
  MapPin,
  PackageOpen,
  PawPrint,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Truck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { DEFAULT_STOP_DWELL_MINUTES } from '@/shared/constants/route-defaults'
import { statusLabels } from '@/shared/lib/status-labels'
import type {
  DailyRoute,
  DailyRouteStop,
  DailyStopKind,
  Letter,
  RouteDirection,
  RouteTemplate,
  ServiceAction,
} from '@/shared/types'
import { StatusBadge } from '@/shared/ui/status-badge'

import { calculateDrivingTimes } from '../application/driving-times'
import { canCloseRouteOn } from '../application/route-closure'
import { StopFormDialog } from './operation-dialogs'

type Props = {
  route: DailyRoute
  template: RouteTemplate
  letters: Letter[]
  onOpenVan?: (route: DailyRoute) => void
  onBack: () => void
  onAction: (ids: string[]) => Promise<void>
  onUpdateStops: (routeId: string, stops: DailyRouteStop[], recalculate?: boolean) => Promise<void>
  onSuggestStop: (
    routeId: string,
    stop: Omit<DailyRouteStop, 'id' | 'kind' | 'mapUrl'>,
  ) => Promise<{ index: number; stops: DailyRouteStop[] }>
  onAddStop: (routeId: string, stops: DailyRouteStop[]) => Promise<void>
  onRemoveStop: (routeId: string, stopId: string) => Promise<void>
  onUpdateService: (routeId: string, service: ServiceAction) => void
  onRemoveService: (routeId: string, serviceId: string) => void
  onCloseRoute: (routeId: string) => Promise<void>
  canManage?: boolean
}
type ServiceGroup = { key: string; actions: ServiceAction[]; animalLabels: string[] }

const kindLabels: Record<DailyStopKind, string> = {
  parada: 'Parada',
  recogida: 'Recogida',
  entrega: 'Entrega',
}
const directionLabel = (direction: RouteDirection) =>
  direction === 'inversa' ? 'Sentido inverso' : 'Sentido habitual'
const formatDuration = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ''}`.trim()
    : `${minutes} min`
const routeStops = (route: DailyRoute, template: RouteTemplate) =>
  route.stops ??
  template.stops.map((stop) => ({
    ...stop,
    kind: 'parada' as const,
    dwellMinutes: DEFAULT_STOP_DWELL_MINUTES,
  }))
const formatRouteDate = (date: string) => ({
  day: new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric' }),
  month: new Date(`${date}T12:00:00`)
    .toLocaleDateString('es-ES', { month: 'short' })
    .replace('.', ''),
})
const formatRouteDay = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

const isoToday = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function RoutesCatalogPage({
  routes,
  templates,
  onSelect,
  onOpenVan,
}: {
  routes: DailyRoute[]
  templates: RouteTemplate[]
  onSelect: (route: DailyRoute) => void
  onOpenVan?: (route: DailyRoute) => void
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | DailyRoute['status']>('todos')
  const today = isoToday()
  const templateName = (route: DailyRoute) =>
    templates.find((item) => item.id === route.templateId)?.name ?? 'Ruta sin plantilla'
  const filteredRoutes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return [...routes]
      .filter((route) => statusFilter === 'todos' || route.status === statusFilter)
      .filter((route) => {
        if (!normalizedQuery) return true
        const name =
          templates.find((template) => template.id === route.templateId)?.name ?? 'Ruta sin plantilla'
        return [name, directionLabel(route.direction ?? 'normal'), statusLabels[route.status]].some(
          (value) => value.toLocaleLowerCase().includes(normalizedQuery),
        )
      })
      .sort((left, right) => left.date.localeCompare(right.date))
  }, [query, routes, statusFilter, templates])
  const countLabel = `${filteredRoutes.length} ${filteredRoutes.length === 1 ? 'ruta' : 'rutas'}`

  return (
    <section className="route-catalog" aria-label="Rutas programadas">
      <div className="route-catalog-heading">
        <div>
          <span className="eyebrow">Planificación</span>
          <strong>Rutas programadas</strong>
        </div>
        <span>{countLabel}</span>
      </div>
      <Card className="route-catalog-card">
        <CardContent>
          <div className="route-catalog-tools">
            <label className="route-search" htmlFor="route-search">
              <Search size={16} />
              <span className="sr-only">Buscar rutas</span>
              <Input
                aria-label="Buscar rutas"
                id="route-search"
                placeholder="Buscar por nombre, sentido o estado"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="route-status-filter">
              <span>Estado</span>
              <select
                aria-label="Filtrar por estado"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as 'todos' | DailyRoute['status'])
                }
              >
                <option value="todos">Todas</option>
                <option value="activa">Activas</option>
                <option value="cerrada">Cerradas</option>
              </select>
            </label>
          </div>
          {filteredRoutes.length ? (
            <div className="route-table-wrap">
              <table className="route-table">
                <caption className="sr-only">Listado de rutas programadas</caption>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Ruta</th>
                    <th scope="col">Operación</th>
                    <th scope="col">Estado</th>
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoutes.map((item) => {
                    const date = formatRouteDate(item.date)
                    const stops =
                      item.stops?.length ??
                      templates.find((template) => template.id === item.templateId)?.stops.length ??
                      0
                    const completed = item.actions.filter(
                      (action) => action.status === 'completada',
                    ).length
                    const services = item.actions.length
                    const isToday = item.date === today
                    return (
                      <tr
                        aria-label={`Abrir recorrido de ${templateName(item)}`}
                        className={isToday ? 'is-today' : undefined}
                        key={item.id}
                        tabIndex={0}
                        onClick={() => onSelect(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onSelect(item)
                          }
                        }}
                      >
                        <td data-label="Fecha">
                          <time className="route-table-date" dateTime={item.date}>
                            {isToday && <span className="route-table-today">Hoy</span>}
                            <strong>{date.day}</strong>
                            <span>{date.month}</span>
                          </time>
                          <span className="route-table-day">{formatRouteDay(item.date)}</span>
                        </td>
                        <td data-label="Ruta">
                          <strong className="route-table-name">{templateName(item)}</strong>
                          <small className="route-table-direction">
                            {directionLabel(item.direction ?? 'normal')}
                          </small>
                        </td>
                        <td data-label="Operación">
                          <strong className="route-table-operation">
                            {stops} {stops === 1 ? 'parada' : 'paradas'}
                          </strong>
                          <small className="route-table-progress">
                            {services ? `${completed}/${services} servicios completados` : 'Sin servicios'}
                          </small>
                        </td>
                        <td data-label="Estado">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="route-table-actions">
                          <Button
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation()
                              onSelect(item)
                            }}
                          >
                            Ver recorrido
                          </Button>
                          {onOpenVan && (
                            <Button
                              aria-label={`Ver furgoneta de ${templateName(item)}`}
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation()
                                onOpenVan(item)
                              }}
                            >
                              <Truck />
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="route-table-empty">
              <Search size={22} />
              <strong>No hay rutas con estos filtros</strong>
              <p>Prueba con otra búsqueda o cambia el estado seleccionado.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
const mapUrlFor = (
  stop: Pick<
    DailyRouteStop,
    | 'alias'
    | 'street'
    | 'streetNumber'
    | 'postalCode'
    | 'locality'
    | 'province'
    | 'country'
    | 'latitude'
    | 'longitude'
  >,
) => {
  if (typeof stop.latitude === 'number' && typeof stop.longitude === 'number')
    return `https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`
  const address = [
    [stop.street, stop.streetNumber].filter(Boolean).join(' '),
    stop.postalCode,
    stop.locality,
    stop.province,
    stop.country || 'España',
  ].filter(Boolean)
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((address.length ? address : [stop.alias]).join(', '))}`
}

function formatArrival(date: string, offsetMinutes: number) {
  const departure = new Date(`${date}T08:00:00`)
  departure.setMinutes(departure.getMinutes() + offsetMinutes)
  return departure.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function groupedServices(route: DailyRoute, stops: DailyRouteStop[], letters: Letter[]) {
  const groupsByStop = new Map<string, ServiceGroup[]>()
  route.actions.forEach((action) => {
    const stopId = action.stopId ?? stops.find((stop) => stop.locality === action.stop)?.id
    if (!stopId) return
    const groups = groupsByStop.get(stopId) ?? []
    const key = [action.type, action.letterId, action.box ?? 'sin-box', stopId].join(':')
    const group = groups.find((item) => item.key === key) ?? { key, actions: [], animalLabels: [] }
    if (!groups.includes(group)) groups.push(group)
    group.actions.push({ ...action, stopId })
    const animal =
      action.animalLabel ??
      letters
        .find((letter) => letter.id === action.letterId)
        ?.animals.find((candidate) => candidate.id === action.animalId)
    const label =
      typeof animal === 'string'
        ? animal
        : animal
          ? [animal.breed, animal.species].filter(Boolean).join(' · ')
          : 'Mascota sin identificar'
    if (!group.animalLabels.includes(label)) group.animalLabels.push(label)
    groupsByStop.set(stopId, groups)
  })
  return groupsByStop
}

export function RoutesPage({
  route,
  template,
  letters,
  onOpenVan,
  onBack,
  onAction,
  onUpdateStops,
  onSuggestStop,
  onAddStop,
  onRemoveStop,
  onCloseRoute,
  canManage = true,
}: Props) {
  const [organizing, setOrganizing] = useState(false)
  const [addingStop, setAddingStop] = useState(false)
  const [plannedStops, setPlannedStops] = useState<DailyRouteStop[] | null>(null)
  const [savingPlan, setSavingPlan] = useState(false)
  const [movingStop, setMovingStop] = useState(false)
  const [deletingStop, setDeletingStop] = useState<DailyRouteStop | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingStop, setEditingStop] = useState<DailyRouteStop | null>(null)
  const [closingRoute, setClosingRoute] = useState(false)
  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false)
  const [operationError, setOperationError] = useState('')
  const stops = plannedStops ?? routeStops(route, template)
  const direction = route.direction ?? 'normal'
  const itineraryClosed = route.status === 'cerrada'
  const canClose = canManage && !itineraryClosed && canCloseRouteOn(route.date)
  const servicesByStop = useMemo(
    () => groupedServices(route, stops, letters),
    [route, stops, letters],
  )
  const travelMinutes = stops.slice(0, -1).reduce((total, stop) => total + stop.minutes, 0)
  const pointMinutes = stops.reduce((total, stop) => total + stop.dwellMinutes, 0)
  const arrivalByStop = new Map<string, number>()
  let elapsedMinutes = 0
  stops.forEach((stop, index) => {
    arrivalByStop.set(stop.id, elapsedMinutes)
    elapsedMinutes += stop.dwellMinutes + (index < stops.length - 1 ? stop.minutes : 0)
  })

  useEffect(() => {
    setOrganizing(false)
    setPlannedStops(null)
  }, [route.id])

  function reportOperationError(error: unknown, fallback: string) {
    setOperationError(error instanceof Error ? error.message : fallback)
  }
  async function moveStop(index: number, direction: -1 | 1) {
    if (movingStop) return
    const target = index + direction
    if (target < 0 || target >= stops.length) return
    const next = [...stops]
      ;[next[index], next[target]] = [next[target], next[index]]
    setMovingStop(true)
    try {
      setOperationError('')
      await onUpdateStops(route.id, next)
    } catch (error) {
      reportOperationError(error, 'No se ha podido actualizar el orden de las paradas.')
    } finally {
      setMovingStop(false)
    }
  }
  async function movePlannedStop(index: number, direction: -1 | 1) {
    if (!plannedStops) return
    const target = index + direction
    if (target < 0 || target >= plannedStops.length) return
    const next = [...plannedStops]
      ;[next[index], next[target]] = [next[target], next[index]]
    try {
      setPlannedStops(await calculateDrivingTimes(next))
    } catch {
      setPlannedStops(next)
    }
  }
  async function setDwellMinutes(index: number, value: string) {
    const dwellMinutes = Math.max(0, Number(value) || 0)
    const next = stops.map((stop, stopIndex) =>
      stopIndex === index ? { ...stop, dwellMinutes } : stop,
    )
    if (plannedStops) setPlannedStops(next)
    else {
      try {
        setOperationError('')
        await onUpdateStops(route.id, next, false)
      } catch (error) {
        reportOperationError(error, 'No se ha podido actualizar el tiempo de espera.')
      }
    }
  }
  async function acceptPlan() {
    if (!plannedStops) return
    setSavingPlan(true)
    try {
      setOperationError('')
      await onAddStop(route.id, plannedStops)
      setPlannedStops(null)
    } catch (error) {
      reportOperationError(error, 'No se ha podido añadir la parada.')
    } finally {
      setSavingPlan(false)
    }
  }
  async function removeStop() {
    if (!deletingStop) return
    setDeleting(true)
    try {
      setOperationError('')
      await onRemoveStop(route.id, deletingStop.id)
      setDeletingStop(null)
    } catch (error) {
      reportOperationError(error, 'No se ha podido eliminar la parada.')
    } finally {
      setDeleting(false)
    }
  }
  async function saveEditedStop(values: Omit<DailyRouteStop, 'id' | 'kind' | 'mapUrl'>) {
    if (!editingStop) return
    const updated = { ...editingStop, ...values, mapUrl: mapUrlFor(values) }
    try {
      setOperationError('')
      await onUpdateStops(
        route.id,
        stops.map((stop) => (stop.id === editingStop.id ? updated : stop)),
      )
      setEditingStop(null)
    } catch (error) {
      reportOperationError(error, 'No se ha podido guardar la parada.')
      throw error
    }
  }
  async function closeRoute() {
    setClosingRoute(true)
    try {
      setOperationError('')
      await onCloseRoute(route.id)
      setCloseConfirmationOpen(false)
    } catch (error) {
      reportOperationError(error, 'No se ha podido cerrar el itinerario.')
    } finally {
      setClosingRoute(false)
    }
  }
  async function updateServices(actionIds: string[]) {
    try {
      setOperationError('')
      await onAction(actionIds)
    } catch (error) {
      reportOperationError(error, 'No se ha podido actualizar el servicio.')
    }
  }

  return (
    <>
      <div className="route-detail-toolbar">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft /> Todas las rutas
        </Button>
      </div>
      <Card className="route-journey">
        <CardContent>
          <div className="journey-header route-journey-header">
            <div className="journey-route-title">
              <time className="route-date" dateTime={route.date}>
                <b>{formatRouteDate(route.date).day}</b>
                <small>{formatRouteDate(route.date).month}</small>
              </time>
              <div>
                <span className="eyebrow">Itinerario del día</span>
                <h3>Ruta {template.name}</h3>
                <div className="journey-route-badges">
                  <span className={`route-direction-badge direction-${direction}`}>
                    {directionLabel(direction)}
                  </span>
                  <StatusBadge status={route.status} className="self-center" />
                </div>
              </div>
            </div>
            <div className="journey-actions">
              <div className="route-total">
                <Clock3 size={16} />
                <span>Estimación total</span>
                <strong>{formatDuration(travelMinutes + pointMinutes)}</strong>
                <small>
                  {formatDuration(travelMinutes)} trayectos · {formatDuration(pointMinutes)} paradas
                </small>
              </div>
              {(onOpenVan || canManage) && (
                <div className="journey-action-buttons" aria-label="Acciones de la ruta">
                  {onOpenVan && (
                    <Button
                      className="journey-view-van"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenVan(route)}
                    >
                      <Truck /> Ver furgoneta
                    </Button>
                  )}
                  {canManage && (
                    <>
                      {!itineraryClosed && (
                        <>
                          <Button
                            className="journey-add-stop"
                            size="sm"
                            onClick={() => setAddingStop(true)}
                            disabled={Boolean(plannedStops)}
                          >
                            <Plus /> Añadir parada
                          </Button>
                          <Button
                            className="journey-organize-stops"
                            variant="outline"
                            size="sm"
                            onClick={() => setOrganizing((current) => !current)}
                          >
                            {organizing ? 'Terminar' : 'Organizar paradas'}
                          </Button>
                        </>
                      )}
                      {canClose && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCloseConfirmationOpen(true)}
                        >
                          <Lock /> Cerrar itinerario
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {operationError && (
            <p className="form-error route-operation-error" role="alert">
              {operationError}
            </p>
          )}
          {itineraryClosed && (
            <p className="itinerary-toolbar">
              <Lock size={15} /> Itinerario cerrado: se conservan las paradas y los tiempos. Aún
              puedes añadir animales en las paradas existentes.
            </p>
          )}
          {plannedStops && (
            <div className="itinerary-toolbar">
              <span>
                <Clock3 size={15} /> Posición sugerida por cercanía y tiempo en coche. Muévela si lo
                necesitas antes de guardarla.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPlannedStops(null)}
                disabled={savingPlan}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={() => void acceptPlan()} disabled={savingPlan}>
                {savingPlan ? 'Guardando…' : 'Aceptar posición'}
              </Button>
            </div>
          )}
          {organizing && !plannedStops && (
            <div className="itinerary-toolbar">
              <span>
                <Clock3 size={15} /> Los trayectos se recalculan en coche al cambiar el orden.
                Ajusta los minutos de espera.
              </span>
            </div>
          )}
          <ol>
            {stops.map((stop, index) => (
              <JourneyStop
                key={stop.id}
                stop={stop}
                index={index}
                total={stops.length}
                arrival={formatArrival(route.date, arrivalByStop.get(stop.id) ?? 0)}
                organizing={!itineraryClosed && (organizing || Boolean(plannedStops))}
                moving={movingStop}
                services={servicesByStop.get(stop.id) ?? []}
                onMove={plannedStops ? movePlannedStop : moveStop}
                onDwellChange={setDwellMinutes}
                onEdit={itineraryClosed || plannedStops ? undefined : () => setEditingStop(stop)}
                onDelete={itineraryClosed || plannedStops ? undefined : () => setDeletingStop(stop)}
                onAction={updateServices}
              />
            ))}
          </ol>
        </CardContent>
      </Card>
      {addingStop && (
        <StopFormDialog
          onClose={() => setAddingStop(false)}
          onAdd={async (stop) => {
            const plan = await onSuggestStop(route.id, stop)
            setPlannedStops(plan.stops)
            setAddingStop(false)
          }}
        />
      )}
      {editingStop && (
        <StopFormDialog
          initialStop={editingStop}
          onClose={() => setEditingStop(null)}
          onAdd={saveEditedStop}
        />
      )}
      <AlertDialog
        open={deletingStop !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingStop(null)
        }}
      >
        <AlertDialogContent className="!w-[calc(100%-2.5rem)] !max-w-[460px] !p-[26px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar parada</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingStop
                ? `¿Eliminar la parada de ${deletingStop.locality}? Se recalcularán los trayectos restantes.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={() => void removeStop()}
            >
              <Trash2 /> {deleting ? 'Eliminando…' : 'Eliminar parada'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={closeConfirmationOpen} onOpenChange={setCloseConfirmationOpen}>
        <AlertDialogContent className="!w-[calc(100%-2.5rem)] !max-w-[460px] !p-[26px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar itinerario</AlertDialogTitle>
            <AlertDialogDescription>
              Se fijarán las paradas y los tiempos de esta ruta. No se enviarán avisos automáticos a
              los clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closingRoute}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={closingRoute} onClick={() => void closeRoute()}>
              <Lock /> {closingRoute ? 'Cerrando…' : 'Cerrar itinerario'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function JourneyStop({
  stop,
  index,
  total,
  arrival,
  organizing,
  moving,
  services,
  onMove,
  onDwellChange,
  onEdit,
  onDelete,
  onAction,
}: {
  stop: DailyRouteStop
  index: number
  total: number
  arrival: string
  organizing: boolean
  moving: boolean
  services: ServiceGroup[]
  onMove: (index: number, direction: -1 | 1) => Promise<void>
  onDwellChange: (index: number, value: string) => Promise<void>
  onEdit?: () => void
  onDelete?: () => void
  onAction: (ids: string[]) => Promise<void>
}) {
  const hasServices = services.length > 0
  return (
    <li>
      <div className="journey-node">{index + 1}</div>
      <div className="journey-stop">
        <div className="journey-place">
          <div>
            <div className="journey-title">
              <h4>{stop.locality}</h4>
              <span className={`stop-kind stop-kind-${stop.kind}`}>{kindLabels[stop.kind]}</span>
            </div>
            <p>{stop.place}</p>
            <div className="journey-times">
              <span className="arrival-time">
                Llegada aprox.: <strong>{arrival}</strong>
              </span>
              <span>Espera: {formatDuration(stop.dwellMinutes)}</span>
              <span>
                {index === total - 1
                  ? 'Fin de ruta'
                  : `Trayecto sig.: ${formatDuration(stop.minutes)}`}
              </span>
            </div>
          </div>
          {stop.mapUrl && (
            <a href={stop.mapUrl} target="_blank" rel="noreferrer">
              <MapPin size={18} /> Abrir mapa
            </a>
          )}
        </div>
        {organizing && (
          <div className="stop-planner">
            <label>
              Espera en esta parada{' '}
              <Input
                type="number"
                min="0"
                step="5"
                inputMode="numeric"
                value={stop.dwellMinutes}
                onChange={(event) => void onDwellChange(index, event.target.value)}
              />
              <span>min</span>
            </label>
            <div className="stop-move-actions">
              <Button
                variant="outline"
                size="sm"
                disabled={moving || index === 0}
                aria-label={`Subir ${stop.locality}`}
                onClick={() => void onMove(index, -1)}
              >
                <ArrowUp /> Subir
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={moving || index === total - 1}
                aria-label={`Bajar ${stop.locality}`}
                onClick={() => void onMove(index, 1)}
              >
                <ArrowDown /> Bajar
              </Button>
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Editar ${stop.locality}`}
                  onClick={onEdit}
                >
                  <Pencil /> Editar
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={hasServices}
                  aria-description={
                    hasServices
                      ? 'No se puede eliminar una parada con recogidas o entregas asociadas.'
                      : `Eliminar ${stop.locality}`
                  }
                  aria-label={`Eliminar ${stop.locality}`}
                  onClick={onDelete}
                >
                  <Trash2 /> Eliminar
                </Button>
              )}
            </div>
          </div>
        )}
        {services.length > 0 && (
          <div className="services">
            {services.map((group) => (
              <ServiceCard
                key={group.key}
                group={group}
                onToggle={() => onAction(group.actions.map((action) => action.id))}
              />
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

function ServiceCard({ group, onToggle }: { group: ServiceGroup; onToggle: () => Promise<void> }) {
  const action = group.actions[0]
  const done = group.actions.every((item) => item.status === 'completada')
  const label = action.type === 'recogida' ? 'Recogida' : 'Entrega'
  const animalCount = group.actions.length
  const animalSummary =
    animalCount === 1
      ? group.animalLabels[0]
      : `${animalCount} animales · ${group.animalLabels.join(' + ')}`
  return (
    <div className={`service-card ${done ? 'is-done' : ''}`}>
      <div className="service-icon">
        {action.type === 'recogida' ? <PackageOpen size={18} /> : <PawPrint size={18} />}
      </div>
      <div>
        <span>
          {label} · {action.box ? `Box ${action.box}` : 'Sin box'} · {animalCount}{' '}
          {animalCount === 1 ? 'animal' : 'animales'}
        </span>
        <strong>{animalSummary}</strong>
        <span className="service-customer">{action.customer}</span>
        <a href={`tel:${action.phone.replaceAll(' ', '')}`}>
          <Phone size={13} /> {action.phone}
        </a>
      </div>
      <Button variant={done ? 'outline' : 'default'} size="sm" onClick={() => void onToggle()}>
        {done ? 'Deshacer' : action.type === 'recogida' ? 'Recogido' : 'Entregado'}
      </Button>
    </div>
  )
}
