import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ArrowDown, ArrowUp, CalendarDays, Clock3, MapPin, PackageOpen, PawPrint, Phone, Plus, Route, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageIntro } from '../components/page-intro'
import { Pagination } from '../components/pagination'
import { statusLabels } from '../lib/status-labels'
import type { DailyRoute, DailyRouteStop, DailyStopKind, Letter, RouteTemplate, ServiceAction } from '../lib/types'

type Props = {
  route: DailyRoute; template: RouteTemplate; templates: RouteTemplate[]; routes: DailyRoute[]; letters: Letter[]
  onSelect: (route: DailyRoute) => void; onAction: (ids: string[]) => void
  onUpdateStops: (routeId: string, stops: DailyRouteStop[]) => void
  onUpdateService: (routeId: string, service: ServiceAction) => void
  onRemoveService: (routeId: string, serviceId: string) => void; onCreate: () => void
  canManage?: boolean
}

const kindLabels: Record<DailyStopKind, string> = { parada: 'Parada', recogida: 'Recogida', entrega: 'Entrega' }
const positiveNumber = (value: string) => Math.max(0, Number(value) || 0)
const formatDuration = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ''}`.trim() : `${minutes} min`

function routeStops(route: DailyRoute, template: RouteTemplate) {
  return route.stops ?? template.stops.map((stop) => ({ ...stop, kind: 'parada' as const, dwellMinutes: 0 }))
}

function animalLabel(action: ServiceAction, letters: Letter[]) {
  if (action.animalLabel) return action.animalLabel
  const animal = letters.find((letter) => letter.id === action.letterId)?.animals.find((candidate) => candidate.id === action.animalId)
  return animal ? [animal.breed, animal.species].filter(Boolean).join(' · ') : 'Mascota sin identificar'
}

type ServiceGroup = { key: string; actions: ServiceAction[]; animalLabels: string[] }

function groupServices(actions: ServiceAction[], letters: Letter[]) {
  const groups = new Map<string, ServiceGroup>()
  actions.forEach((action) => {
    const key = [action.type, action.letterId, action.box ?? 'sin-box', action.stopId ?? action.stop].join(':')
    const current = groups.get(key) ?? { key, actions: [], animalLabels: [] }
    current.actions.push(action)
    const label = animalLabel(action, letters)
    if (!current.animalLabels.includes(label)) current.animalLabels.push(label)
    groups.set(key, current)
  })
  return [...groups.values()]
}

export function RoutesPage({ route, template, templates, routes, letters, onSelect, onAction, onUpdateStops, onUpdateService, onRemoveService, onCreate, canManage = true }: Props) {
  const pageSize = 12
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(false)
  const pageCount = Math.max(1, Math.ceil(routes.length / pageSize))
  const selectedIndex = routes.findIndex((item) => item.id === route.id)
  const visibleRoutes = routes.slice((page - 1) * pageSize, page * pageSize)
  const firstRecord = routes.length === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRecord = Math.min(page * pageSize, routes.length)
  const stops = routeStops(route, template)
  const servicesByStop = new Map<string, ServiceAction[]>()
  route.actions.forEach((action) => {
    const stopId = action.stopId ?? stops.find((stop) => stop.locality === action.stop)?.id
    if (!stopId) return
    servicesByStop.set(stopId, [...(servicesByStop.get(stopId) ?? []), { ...action, stopId }])
  })
  const serviceGroupsByStop = new Map<string, ServiceGroup[]>()
  servicesByStop.forEach((services, stopId) => serviceGroupsByStop.set(stopId, groupServices(services, letters)))
  const travelMinutes = stops.slice(0, -1).reduce((total, stop) => total + stop.minutes, 0)
  const pointMinutes = stops.reduce((total, stop) => total + stop.dwellMinutes, 0)
  const serviceMinutes = [...serviceGroupsByStop.values()].flat().reduce((total, group) => total + (group.actions[0].dwellMinutes ?? 15), 0)
  const totalMinutes = travelMinutes + pointMinutes + serviceMinutes
  const elapsedByStop = new Map<string, number>()
  let elapsedMinutes = 0
  stops.forEach((stop, index) => {
    elapsedMinutes += stop.dwellMinutes + (serviceGroupsByStop.get(stop.id) ?? []).reduce((total, group) => total + (group.actions[0].dwellMinutes ?? 15), 0)
    elapsedByStop.set(stop.id, elapsedMinutes)
    if (index < stops.length - 1) elapsedMinutes += stop.minutes
  })

  useEffect(() => { setPage((current) => Math.min(current, pageCount)) }, [pageCount])
  useEffect(() => { if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / pageSize) + 1) }, [selectedIndex])
  useEffect(() => { setEditing(false) }, [route.id])

  function updateStop(stopId: string, patch: Partial<DailyRouteStop>) {
    onUpdateStops(route.id, stops.map((stop) => {
      if (stop.id !== stopId) return stop
      const next = { ...stop, ...patch }
      if ('locality' in patch || 'place' in patch) next.mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${next.place} ${next.locality}`)}`
      return next
    }))
  }

  function moveStop(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= stops.length) return
    const next = [...stops]
      ;[next[index], next[target]] = [next[target], next[index]]
    onUpdateStops(route.id, next)
  }

  function addStop() {
    onUpdateStops(route.id, [...stops, { id: crypto.randomUUID(), locality: 'Nueva parada', place: 'Indica la dirección o punto', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Nueva%20parada', minutes: 0, dwellMinutes: 15, kind: 'parada' }])
  }

  function moveService(service: ServiceAction, direction: -1 | 1) {
    const stopId = service.stopId ?? stops.find((stop) => stop.locality === service.stop)?.id
    const current = stops.findIndex((stop) => stop.id === stopId)
    const target = current + direction
    if (current < 0 || target < 0 || target >= stops.length) return
    const nextStop = stops[target]
    onUpdateService(route.id, { ...service, stopId: nextStop.id, stop: nextStop.locality })
  }

  return <>
    <PageIntro text={canManage ? 'Edita el orden y los tiempos de esta ruta diaria sin modificar su plantilla.' : 'Consulta el itinerario asignado y registra las recogidas y entregas realizadas.'}>
      {canManage && <Button onClick={onCreate}><CalendarDays /> Crear ruta</Button>}
    </PageIntro>
    <div className="route-selector">{visibleRoutes.map((item) => <button type="button" onClick={() => onSelect(item)} className={route.id === item.id ? 'is-selected' : ''} key={item.id}><Route size={16} /><span>{templates.find((current) => current.id === item.templateId)?.name}</span><b>{new Date(`${item.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</b><span className={`status status-${item.status}`}>{statusLabels[item.status]}</span></button>)}</div>
    <Pagination page={page} pageCount={pageCount} firstRecord={firstRecord} lastRecord={lastRecord} total={routes.length} ariaLabel="Paginación de rutas" onChange={setPage} />
    <Card className="route-journey"><CardContent>
      <div className="journey-header"><div><span className="eyebrow">{route.date}</span><h3>Ruta {template.name}</h3></div><div className="journey-actions"><div className="route-total"><Clock3 size={16} /><span>Estimación total</span><strong>{formatDuration(totalMinutes)}</strong><small>{formatDuration(travelMinutes)} trayectos · {formatDuration(pointMinutes + serviceMinutes)} puntos</small></div><span className={`status status-${route.status}`}>{statusLabels[route.status]}</span>{canManage && <Button variant="outline" size="sm" onClick={() => setEditing((current) => !current)}>{editing ? 'Terminar edición' : 'Editar itinerario'}</Button>}</div></div>
      {editing && <div className="itinerary-toolbar"><span><Clock3 size={15} /> Define el tiempo previsto de cada punto. La estimación total se recalcula al instante.</span><Button size="sm" onClick={addStop}><Plus /> Añadir punto</Button></div>}
      <ol>{stops.map((stop, index) => {
        const serviceGroups = serviceGroupsByStop.get(stop.id) ?? []
        return <li key={stop.id}><div className="journey-node">{index + 1}</div><div className="journey-stop">
          <div className="journey-place"><div><div className="journey-title"><h4>{stop.locality}</h4><span className={`stop-kind stop-kind-${stop.kind}`}>{kindLabels[stop.kind]}</span></div><p>{stop.place}</p><div className="journey-times"><span>Previsto: {formatDuration(stop.dwellMinutes)}</span><span>Acumulado: {formatDuration(elapsedByStop.get(stop.id) ?? 0)}</span><span>{index === stops.length - 1 ? 'Fin de ruta' : `Trayecto sig.: ${formatDuration(stop.minutes)}`}</span></div></div>{stop.mapUrl && <a href={stop.mapUrl} target="_blank" rel="noreferrer"><MapPin size={18} /> Abrir mapa</a>}</div>
          {editing && <StopEditor stop={stop} isFirst={index === 0} isLast={index === stops.length - 1} onChange={(patch) => updateStop(stop.id, patch)} onMove={(direction) => moveStop(index, direction)} onRemove={() => onUpdateStops(route.id, stops.filter((candidate) => candidate.id !== stop.id))} />}
          {serviceGroups.length > 0 && <div className="services">{serviceGroups.map((group) => <ServiceCard key={group.key} group={group} editing={editing} onToggle={() => onAction(group.actions.map((action) => action.id))} onChange={(next) => next.forEach((action) => onUpdateService(route.id, action))} onMove={(direction) => group.actions.forEach((action) => moveService(action, direction))} onRemove={() => group.actions.forEach((action) => onRemoveService(route.id, action.id))} />)}</div>}
        </div></li>
      })}</ol>
    </CardContent></Card>
  </>
}

function StopEditor({ stop, isFirst, isLast, onChange, onMove, onRemove }: { stop: DailyRouteStop; isFirst: boolean; isLast: boolean; onChange: (patch: Partial<DailyRouteStop>) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  return <div className="stop-editor"><label>Tipo<select value={stop.kind} onChange={(event) => onChange({ kind: event.target.value as DailyStopKind })}><option value="parada">Parada</option><option value="recogida">Recogida</option><option value="entrega">Entrega</option></select></label><label>Localidad o domicilio<Input value={stop.locality} onChange={(event) => onChange({ locality: event.target.value })} /></label><label>Punto / dirección<Input value={stop.place} onChange={(event) => onChange({ place: event.target.value })} /></label><label>Tiempo previsto en el punto (min)<Input type="number" min="0" value={stop.dwellMinutes} onChange={(event) => onChange({ dwellMinutes: positiveNumber(event.target.value) })} /></label><label>Trayecto siguiente (min)<Input type="number" min="0" value={stop.minutes} onChange={(event) => onChange({ minutes: positiveNumber(event.target.value) })} /></label><div className="stop-editor-actions"><Button variant="outline" size="icon" disabled={isFirst} aria-label="Subir punto" onClick={() => onMove(-1)}><ArrowUp /></Button><Button variant="outline" size="icon" disabled={isLast} aria-label="Bajar punto" onClick={() => onMove(1)}><ArrowDown /></Button><Button variant="outline" size="icon" className="danger-icon" aria-label="Eliminar punto" onClick={onRemove}><Trash2 /></Button></div></div>
}

function ServiceCard({ group, editing, onToggle, onChange, onMove, onRemove }: { group: ServiceGroup; editing: boolean; onToggle: () => void; onChange: (actions: ServiceAction[]) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  const action = group.actions[0]
  const done = group.actions.every((item) => item.status === 'completada')
  const label = action.type === 'recogida' ? 'Recogida' : 'Entrega'
  const animalCount = group.actions.length
  const animalSummary = animalCount === 1 ? group.animalLabels[0] : `${animalCount} animales · ${group.animalLabels.join(' + ')}`
  return <div className={`service-card ${done ? 'is-done' : ''}`}><div className="service-icon">{action.type === 'recogida' ? <PackageOpen size={18} /> : <PawPrint size={18} />}</div><div><span>{label} · {action.box ? `Box ${action.box}` : 'Sin box'} · {animalCount} {animalCount === 1 ? 'animal' : 'animales'}</span><strong>{animalSummary}</strong><span className="service-customer">{action.customer}</span><a href={`tel:${action.phone.replaceAll(' ', '')}`}><Phone size={13} /> {action.phone}</a>{editing && <label className="service-duration">Tiempo de {label.toLocaleLowerCase()}<Input type="number" min="0" value={action.dwellMinutes ?? 15} onChange={(event) => onChange(group.actions.map((item) => ({ ...item, dwellMinutes: positiveNumber(event.target.value) })))} /><span>min</span></label>}</div>{editing ? <div className="service-editor-actions"><Button variant="outline" size="icon" aria-label={`Mover ${label.toLocaleLowerCase()} antes`} onClick={() => onMove(-1)}><ArrowUp /></Button><Button variant="outline" size="icon" aria-label={`Mover ${label.toLocaleLowerCase()} después`} onClick={() => onMove(1)}><ArrowDown /></Button><Button variant="outline" size="icon" className="danger-icon" aria-label={`Eliminar ${label.toLocaleLowerCase()}`} onClick={onRemove}><Trash2 /></Button></div> : <Button variant={done ? 'outline' : 'default'} size="sm" onClick={onToggle}>{done ? 'Deshacer' : action.type === 'recogida' ? 'Recogido' : 'Entregado'}</Button>}</div>
}
