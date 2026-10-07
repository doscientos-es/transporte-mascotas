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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Input,
  Pagination,
} from '@doscientos/ui'
import {
  ArrowLeft,
  ArrowUpDown,
  Clock3,
  FileSpreadsheet,
  GripVertical,
  Lock,
  MapPin,
  MoreHorizontal,
  PackageOpen,
  PawPrint,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Truck,
} from 'lucide-react'
import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'

import {
  DEFAULT_ROUTE_START_TIME,
  DEFAULT_STOP_DWELL_MINUTES,
} from '@/shared/constants/route-defaults'
import { paginate } from '@/shared/lib/pagination'
import { routeStopArrivals } from '@/shared/lib/route-days'
import { readEnumParam, readPageParam } from '@/shared/lib/search-params'
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
import { useUrlParams } from '@/shared/ui/use-url-params'
import { WhatsAppLink } from '@/shared/ui/whatsapp-link'

import { DRIVER_SHEET_HEADER, driverSheetRows } from '../application/driver-sheet'
import { calculateDrivingTimes } from '../application/driving-times'
import { DEFAULT_ROUTE_SORT_DIRECTION, sortRoutesByDate } from '../application/route-order'
import { transportReminderMessage, type ReminderPoint } from '../application/service-reminder'
import { mergedStopInstructions } from '../application/stop-instructions'
import { moveItemAtInsertionIndex } from '../application/stop-order'
import { StopFormDialog } from './operation-dialogs'

type Props = {
  route: DailyRoute
  template: RouteTemplate
  letters: Letter[]
  onOpenVan?: (route: DailyRoute) => void
  onBack: () => void
  onAction: (ids: string[]) => Promise<void>
  onUpdateStops: (routeId: string, stops: DailyRouteStop[], recalculate?: boolean) => Promise<void>
  onUpdateStartTime?: (routeId: string, startTime: string) => Promise<void>
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
const routeStatusFilters = ['todos', 'activa', 'cerrada'] as const
const sortDirections = ['asc', 'desc'] as const
const ROUTE_LIST_PAGE_SIZE = 12

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
  const { searchParams, updateParams } = useUrlParams()
  const query = searchParams.get('q') ?? ''
  const statusFilter = readEnumParam(searchParams.get('estado'), routeStatusFilters, 'todos')
  const direction = readEnumParam(
    searchParams.get('direccion'),
    sortDirections,
    DEFAULT_ROUTE_SORT_DIRECTION,
  )
  const requestedPage = readPageParam(searchParams.get('pagina'))
  const today = isoToday()
  const templateName = (route: DailyRoute) =>
    templates.find((item) => item.id === route.templateId)?.name ?? 'Ruta sin plantilla'
  const filteredRoutes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const matchingRoutes = [...routes]
      .filter((route) => statusFilter === 'todos' || route.status === statusFilter)
      .filter((route) => {
        if (!normalizedQuery) return true
        const name =
          templates.find((template) => template.id === route.templateId)?.name ??
          'Ruta sin plantilla'
        return [name, directionLabel(route.direction ?? 'normal'), statusLabels[route.status]].some(
          (value) => value.toLocaleLowerCase().includes(normalizedQuery),
        )
      })
    return sortRoutesByDate(matchingRoutes, direction)
  }, [direction, query, routes, statusFilter, templates])
  const routePagination = paginate(filteredRoutes, requestedPage, ROUTE_LIST_PAGE_SIZE)
  const countLabel = `${filteredRoutes.length} ${filteredRoutes.length === 1 ? 'ruta' : 'rutas'}`

  useEffect(() => {
    if (requestedPage > routePagination.pageCount) {
      updateParams({
        pagina: routePagination.pageCount === 1 ? undefined : routePagination.pageCount,
      })
    }
  }, [requestedPage, routePagination.pageCount, updateParams])

  return (
    <section className="route-catalog" aria-label="Rutas programadas">
      <div className="route-catalog-heading">
        <div>
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
                onChange={(event) => updateParams({ q: event.target.value, pagina: undefined })}
              />
            </label>
            <label className="route-status-filter" htmlFor="route-status-filter">
              <span>Estado</span>
              <select
                id="route-status-filter"
                aria-label="Filtrar por estado"
                value={statusFilter}
                onChange={(event) =>
                  updateParams({
                    estado: event.target.value === 'todos' ? undefined : event.target.value,
                    pagina: undefined,
                  })
                }
              >
                <option value="todos">Todas</option>
                <option value="activa">Activas</option>
                <option value="cerrada">Cerradas</option>
              </select>
            </label>
            <label className="route-status-filter" htmlFor="route-sort-direction">
              <span>Orden</span>
              <select
                id="route-sort-direction"
                aria-label="Ordenar rutas por fecha"
                value={direction}
                onChange={(event) =>
                  updateParams({ direccion: event.target.value, pagina: undefined })
                }
              >
                <option value="asc">Más próximas</option>
                <option value="desc">Más lejanas</option>
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
                    <th scope="col">Transportes</th>
                    <th scope="col">Estado</th>
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {routePagination.items.map((item) => {
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
                            {services
                              ? `${completed}/${services} servicios completados`
                              : 'Sin servicios'}
                          </small>
                        </td>
                        <td data-label="Transportes">
                          <strong className="route-table-operation">
                            {routeTransportCount(item)}
                          </strong>
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
              <strong>
                {routes.length === 0
                  ? 'Todavía no hay rutas asignadas'
                  : 'No hay rutas con estos filtros'}
              </strong>
              <p>
                {routes.length === 0
                  ? 'Cuando administración te asigne una ruta aparecerá aquí.'
                  : 'Prueba con otra búsqueda o cambia el estado seleccionado.'}
              </p>
            </div>
          )}
          {filteredRoutes.length > 0 && (
            <Pagination
              page={routePagination.page}
              pageCount={routePagination.pageCount}
              ariaLabel="Paginación de rutas"
              onPageChange={(nextPage) =>
                updateParams({ pagina: nextPage === 1 ? undefined : nextPage })
              }
              summary={`Mostrando ${routePagination.firstRecord}–${routePagination.lastRecord} de ${filteredRoutes.length}`}
            />
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

/** Arrival time, plus the day when the route is already past its first day. */
function formatArrival(date: string, arrival: { date: string; time: string }) {
  if (arrival.date === date) return arrival.time
  const day = new Date(`${arrival.date}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return `${arrival.time} (${day})`
}

// A transport is one carriage letter, however many stops or animals it has on the route.
function routeTransportCount(route: DailyRoute) {
  return new Set(route.actions.map((action) => action.letterId)).size
}

function transportsLabel(count: number) {
  return `${count} ${count === 1 ? 'transporte' : 'transportes'}`
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
  onUpdateStartTime,
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
  const [reorderingStops, setReorderingStops] = useState(false)
  const [deletingStop, setDeletingStop] = useState<DailyRouteStop | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingStop, setEditingStop] = useState<DailyRouteStop | null>(null)
  const [closingRoute, setClosingRoute] = useState(false)
  const [recalculatingTimes, setRecalculatingTimes] = useState(false)
  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false)
  const [operationError, setOperationError] = useState('')
  const stops = plannedStops ?? routeStops(route, template)
  const direction = route.direction ?? 'normal'
  const startTime = route.startTime ?? DEFAULT_ROUTE_START_TIME
  const itineraryClosed = route.status === 'cerrada'
  const servicesByStop = useMemo(
    () => groupedServices(route, stops, letters),
    [route, stops, letters],
  )
  const travelMinutes = stops.slice(0, -1).reduce((total, stop) => total + stop.minutes, 0)
  const pointMinutes = stops.reduce((total, stop) => total + stop.dwellMinutes, 0)
  const stopArrivals = routeStopArrivals(route.date, startTime, stops)
  const arrivalByStop = new Map(stops.map((stop, index) => [stop.id, stopArrivals[index]]))
  const pointFor = (letterId: string, type: ServiceAction['type']): ReminderPoint | undefined => {
    const action = route.actions.find((item) => item.letterId === letterId && item.type === type)
    const stop = action
      ? stops.find((item) => item.id === (action.stopId ?? '') || item.locality === action.stop)
      : undefined
    const arrival = stop ? arrivalByStop.get(stop.id) : undefined
    if (!stop || !arrival) return undefined
    return {
      place: [stop.locality, stop.place].filter(Boolean).join(' · '),
      ...arrival,
    }
  }

  useEffect(() => {
    setOrganizing(false)
    setPlannedStops(null)
    setReorderingStops(false)
  }, [route.id])

  function reportOperationError(error: unknown, fallback: string) {
    setOperationError(error instanceof Error ? error.message : fallback)
  }
  async function saveReorderedStops(nextStops: DailyRouteStop[]) {
    if (plannedStops) {
      try {
        setPlannedStops(await calculateDrivingTimes(nextStops))
      } catch {
        setPlannedStops(nextStops)
      }
      return
    }
    setOperationError('')
    await onUpdateStops(route.id, nextStops)
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
  async function setTravelMinutes(index: number, value: string) {
    const minutes = Math.max(1, Number(value) || 1)
    const next = stops.map((stop, stopIndex) => (stopIndex === index ? { ...stop, minutes } : stop))
    if (plannedStops) setPlannedStops(next)
    else {
      try {
        setOperationError('')
        await onUpdateStops(route.id, next, false)
      } catch (error) {
        reportOperationError(error, 'No se ha podido actualizar el tiempo de trayecto.')
      }
    }
  }
  async function recalculateRouteTimes() {
    setRecalculatingTimes(true)
    setOperationError('')
    setOrganizing(false)
    try {
      const updatedStops = await calculateDrivingTimes(stops)
      await onUpdateStops(route.id, updatedStops, false)
    } catch (error) {
      reportOperationError(error, 'No se han podido recalcular los tiempos de trayecto.')
    } finally {
      setRecalculatingTimes(false)
    }
  }
  async function changeStartTime(value: string) {
    if (!value || !onUpdateStartTime) return
    try {
      setOperationError('')
      await onUpdateStartTime(route.id, value)
    } catch (error) {
      reportOperationError(error, 'No se ha podido actualizar la hora de salida.')
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
  async function downloadDriverSheet() {
    const rows = driverSheetRows(route, stops, letters, (stop) =>
      formatArrival(
        route.date,
        arrivalByStop.get(stop.id) ?? { date: route.date, time: startTime },
      ),
    )
    // Loaded on demand: exceljs is large and only needed when exporting.
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    const sheet = workbook.addWorksheet(`Ruta ${template.name}`.slice(0, 31), {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToHeight: 0 },
    })
    sheet.addRow(DRIVER_SHEET_HEADER).font = { bold: true }
    rows.forEach((row) => sheet.addRow(row))
    sheet.columns.forEach((column, index) => {
      const longest = Math.max(
        ...[DRIVER_SHEET_HEADER, ...rows].map((row) => String(row[index]).length),
      )
      column.width = Math.min(40, longest + 3)
    })
    sheet.eachRow((row) =>
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        }
      }),
    )
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ruta-${template.name}-${route.date}.xlsx`.replace(/\s+/g, '-').toLowerCase()
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
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
          <div className="journey-header route-journey-header route-header-premium">
            <div className="route-header-overview">
              <div className="route-header-identity">
                <time className="route-date" dateTime={route.date}>
                  <b>{formatRouteDate(route.date).day}</b>
                  <small>{formatRouteDate(route.date).month}</small>
                </time>
                <div className="route-header-copy">
                  <h3>Ruta {template.name}</h3>
                  <div className="route-header-meta">
                    <span>{directionLabel(direction)}</span>
                    <span className="route-header-meta-divider" aria-hidden="true">
                      ·
                    </span>
                    <span>{transportsLabel(routeTransportCount(route))}</span>
                    <StatusBadge status={route.status} />
                  </div>
                </div>
              </div>
              <div className="route-header-stats">
                <div className="route-start-field">
                  <span>Hora de salida</span>
                  {canManage && !itineraryClosed && onUpdateStartTime ? (
                    <input
                      type="time"
                      aria-label="Hora de salida del origen"
                      className="route-start-input"
                      value={startTime}
                      onChange={(event) => void changeStartTime(event.target.value)}
                    />
                  ) : (
                    <strong>{startTime}</strong>
                  )}
                </div>
                <div className="route-estimate">
                  <span>Tiempo total estimado</span>
                  <strong>{formatDuration(travelMinutes + pointMinutes)}</strong>
                  <small>
                    {formatDuration(travelMinutes)} en trayectos · {formatDuration(pointMinutes)} en
                    paradas
                  </small>
                </div>
              </div>
            </div>
            {(onOpenVan || canManage) && (
              <div className="route-header-toolbar">
                <div className="route-header-primary-actions">
                  {canManage && !itineraryClosed && (
                    <>
                      <Button
                        className="journey-add-stop"
                        size="sm"
                        onClick={() => setAddingStop(true)}
                        disabled={Boolean(plannedStops) || recalculatingTimes}
                      >
                        <Plus /> Añadir parada
                      </Button>
                      <Button
                        className="journey-reorder-stops"
                        variant="outline"
                        size="sm"
                        onClick={() => setReorderingStops(true)}
                        disabled={savingPlan || recalculatingTimes}
                      >
                        <ArrowUpDown /> Reordenar paradas
                      </Button>
                      <Button
                        className="journey-organize-stops"
                        variant="outline"
                        size="sm"
                        onClick={() => setOrganizing((current) => !current)}
                        disabled={recalculatingTimes}
                      >
                        {organizing ? 'Terminar' : 'Organizar paradas'}
                      </Button>
                      <Button
                        className="journey-recalculate-times"
                        variant="outline"
                        size="sm"
                        onClick={() => void recalculateRouteTimes()}
                        disabled={recalculatingTimes || Boolean(plannedStops) || stops.length < 2}
                      >
                        <Clock3 /> {recalculatingTimes ? 'Calculando…' : 'Recalcular tiempos'}
                      </Button>
                    </>
                  )}
                </div>
                <DropdownMenu
                  trigger={
                    <Button className="route-header-more" variant="outline" size="sm">
                      <MoreHorizontal /> Más acciones
                    </Button>
                  }
                  placement="bottom end"
                  className="min-w-48"
                >
                  <DropdownMenuItem onAction={() => void downloadDriverSheet()}>
                    <FileSpreadsheet /> Descargar Excel
                  </DropdownMenuItem>
                  {onOpenVan && (
                    <DropdownMenuItem onAction={() => onOpenVan(route)}>
                      <Truck /> Ver furgoneta
                    </DropdownMenuItem>
                  )}
                  {canManage && !itineraryClosed && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onAction={() => setCloseConfirmationOpen(true)}
                      >
                        <Lock /> Cerrar itinerario
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenu>
              </div>
            )}
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
                <Clock3 size={15} /> Los trayectos se calculan en coche por defecto y se recalculan
                al cambiar el orden. Puedes ajustar a mano los minutos de espera y de trayecto.
              </span>
            </div>
          )}
          <ol>
            {stops.map((stop, index) => (
              <JourneyStop
                key={stop.id}
                stop={stop}
                index={index}
                nextStop={stops[index + 1]?.locality}
                arrival={formatArrival(
                  route.date,
                  arrivalByStop.get(stop.id) ?? { date: route.date, time: startTime },
                )}
                pointFor={pointFor}
                organizing={
                  !recalculatingTimes && !itineraryClosed && (organizing || Boolean(plannedStops))
                }
                services={servicesByStop.get(stop.id) ?? []}
                onDwellChange={setDwellMinutes}
                onTravelChange={setTravelMinutes}
                onEdit={
                  itineraryClosed || plannedStops || recalculatingTimes
                    ? undefined
                    : () => setEditingStop(stop)
                }
                onDelete={
                  itineraryClosed || plannedStops || recalculatingTimes
                    ? undefined
                    : () => setDeletingStop(stop)
                }
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
      {reorderingStops && (
        <ReorderStopsDialog
          stops={stops}
          onClose={() => setReorderingStops(false)}
          onSave={saveReorderedStops}
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
  nextStop,
  arrival,
  pointFor,
  organizing,
  services,
  onDwellChange,
  onTravelChange,
  onEdit,
  onDelete,
  onAction,
}: {
  stop: DailyRouteStop
  index: number
  nextStop?: string
  arrival: string
  pointFor: (letterId: string, type: ServiceAction['type']) => ReminderPoint | undefined
  organizing: boolean
  services: ServiceGroup[]
  onDwellChange: (index: number, value: string) => Promise<void>
  onTravelChange: (index: number, value: string) => Promise<void>
  onEdit?: () => void
  onDelete?: () => void
  onAction: (ids: string[]) => Promise<void>
}) {
  const hasServices = services.length > 0
  const instructions = mergedStopInstructions(stop.alias, stop.place)
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
            {instructions && <p>{instructions}</p>}
            <div className="journey-times">
              <span className="arrival-time">
                Llegada aprox.: <strong>{arrival}</strong>
              </span>
              <span>Espera: {formatDuration(stop.dwellMinutes)}</span>
              {!nextStop && <span>Fin de ruta</span>}
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
                reminder={serviceReminder(group, pointFor)}
                onToggle={() => onAction(group.actions.map((action) => action.id))}
              />
            ))}
          </div>
        )}
        {nextStop && (
          <div className="journey-leg">
            <Clock3 size={14} aria-hidden="true" />
            <span>Trayecto a {nextStop}</span>
            {organizing ? (
              <label className="journey-leg-editor" htmlFor={`journey-leg-${stop.id}`}>
                <Input
                  id={`journey-leg-${stop.id}`}
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  aria-label={`Minutos de trayecto hasta ${nextStop}`}
                  value={stop.minutes}
                  onChange={(event) => void onTravelChange(index, event.target.value)}
                />
                <span>min</span>
              </label>
            ) : (
              <strong>{formatDuration(stop.minutes)}</strong>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

function ReorderStopsDialog({
  stops,
  onClose,
  onSave,
}: {
  stops: DailyRouteStop[]
  onClose: () => void
  onSave: (stops: DailyRouteStop[]) => Promise<void>
}) {
  const [orderedStops, setOrderedStops] = useState(stops)
  const [draggedStopId, setDraggedStopId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dragState = useRef<{
    pointerId: number
    stopId: string
    destinationIndex: number | null
  } | null>(null)
  const unchanged = orderedStops.every((stop, index) => stop.id === stops[index]?.id)

  function moveStop(sourceIndex: number, destinationIndex: number) {
    setOrderedStops((current) => moveItemAtInsertionIndex(current, sourceIndex, destinationIndex))
  }

  function startDragging(event: PointerEvent<HTMLButtonElement>, stopId: string) {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragState.current = { pointerId: event.pointerId, stopId, destinationIndex: null }
    setDraggedStopId(stopId)
  }

  function updateDropTarget(event: PointerEvent<HTMLButtonElement>) {
    const activeDrag = dragState.current
    if (activeDrag?.pointerId !== event.pointerId) return

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-reorder-index]')
    if (!target) {
      activeDrag.destinationIndex = null
      setDropIndex(null)
      return
    }

    const targetIndex = Number(target.dataset.reorderIndex)
    const { top, height } = target.getBoundingClientRect()
    const destinationIndex = targetIndex + (event.clientY > top + height / 2 ? 1 : 0)
    activeDrag.destinationIndex = destinationIndex
    setDropIndex(destinationIndex)
  }

  function finishDragging(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const activeDrag = dragState.current
    if (activeDrag?.pointerId !== event.pointerId) return
    if (!cancelled && activeDrag.destinationIndex !== null) {
      const sourceIndex = orderedStops.findIndex((stop) => stop.id === activeDrag.stopId)
      moveStop(sourceIndex, activeDrag.destinationIndex)
    }
    dragState.current = null
    setDraggedStopId(null)
    setDropIndex(null)
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const direction = event.key === 'ArrowUp' ? -1 : 1
    const destinationIndex = index + direction
    if (destinationIndex < 0 || destinationIndex >= orderedStops.length) return
    moveStop(index, destinationIndex + (direction > 0 ? 1 : 0))
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      await onSave(orderedStops)
      onClose()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se ha podido actualizar el orden de las paradas.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose()
      }}
    >
      <DialogContent className="dialog-card route-create-dialog reorder-stops-dialog w-[calc(100%-2.5rem)]! max-w-115! p-6.5!">
        <DialogHeader className="gap-0">
          <DialogTitle>Reordenar paradas</DialogTitle>
          <DialogDescription>
            Arrastra cada parada a su nueva posición. También puedes seleccionarla y usar las
            flechas del teclado.
          </DialogDescription>
        </DialogHeader>
        <p className="reorder-drop-hint" aria-live="polite">
          {dropIndex === null
            ? 'Mantén pulsada una parada y arrástrala al lugar deseado.'
            : dropIndex >= orderedStops.length
              ? 'Se colocará al final de la lista.'
              : `Se colocará antes de ${orderedStops[dropIndex].locality}.`}
        </p>
        <ol className="reorder-stops-list">
          {orderedStops.map((stop, index) => (
            <li
              className={[
                draggedStopId === stop.id ? 'is-dragging' : '',
                dropIndex === index ? 'is-drop-before' : '',
                dropIndex === orderedStops.length && index === orderedStops.length - 1
                  ? 'is-drop-after'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-reorder-index={index}
              key={stop.id}
            >
              <button
                type="button"
                className="reorder-stop-item"
                aria-label={`Mover ${stop.locality}, posición ${index + 1} de ${orderedStops.length}`}
                aria-keyshortcuts="ArrowUp ArrowDown"
                title="Mantén pulsado para arrastrar; también puedes usar las flechas del teclado"
                onKeyDown={(event) => moveWithKeyboard(event, index)}
                onPointerDown={(event) => startDragging(event, stop.id)}
                onPointerMove={updateDropTarget}
                onPointerUp={(event) => finishDragging(event)}
                onPointerCancel={(event) => finishDragging(event, true)}
              >
                <span className="reorder-stop-index">{index + 1}</span>
                <span className="reorder-stop-description">
                  <strong>{stop.locality}</strong>
                  <small>
                    {[kindLabels[stop.kind], mergedStopInstructions(stop.alias, stop.place)]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
                <GripVertical size={18} className="reorder-stop-grip" />
              </button>
            </li>
          ))}
        </ol>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="reorder-stops-footer">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || unchanged}>
            {saving ? 'Guardando…' : 'Guardar orden'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function serviceReminder(
  group: ServiceGroup,
  pointFor: (letterId: string, type: ServiceAction['type']) => ReminderPoint | undefined,
) {
  const action = group.actions[0]
  const message = transportReminderMessage({
    pickup: pointFor(action.letterId, 'recogida'),
    delivery: pointFor(action.letterId, 'entrega'),
  })
  return `Hola ${action.customer}, te escribimos de Kache Envíos sobre el transporte de ${group.animalLabels.join(' y ')}.\n\n${message}`
}

function ServiceCard({
  group,
  reminder,
  onToggle,
}: {
  group: ServiceGroup
  reminder: string
  onToggle: () => Promise<void>
}) {
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
        <WhatsAppLink
          phone={action.phone}
          message={reminder}
          label="Enviar recordatorio"
          recipient={action.customer}
        />
      </div>
      <Button variant={done ? 'outline' : 'default'} size="sm" onClick={() => void onToggle()}>
        {done ? 'Deshacer' : action.type === 'recogida' ? 'Recogido' : 'Entregado'}
      </Button>
    </div>
  )
}
