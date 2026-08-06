import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ArrowDown, ArrowUp, CalendarDays, Clock3, MapPin, PackageOpen, PawPrint, Phone, Plus, Route, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageIntro } from '../components/page-intro'
import { Pagination } from '../components/pagination'
import { statusLabels } from '../lib/status-labels'
import type { DailyRoute, DailyRouteStop, DailyStopKind, RouteTemplate, ServiceAction } from '../lib/types'

type Props = {
  route: DailyRoute; template: RouteTemplate; templates: RouteTemplate[]; routes: DailyRoute[]
  onSelect: (route: DailyRoute) => void; onAction: (id: string) => void
  onUpdateStops: (routeId: string, stops: DailyRouteStop[]) => void
  onUpdateService: (routeId: string, service: ServiceAction) => void
  onRemoveService: (routeId: string, serviceId: string) => void; onCreate: () => void
}

const kindLabels: Record<DailyStopKind, string> = { parada: 'Parada', recogida: 'Recogida', entrega: 'Entrega' }
const positiveNumber = (value: string) => Math.max(0, Number(value) || 0)

function routeStops(route: DailyRoute, template: RouteTemplate) {
  return route.stops ?? template.stops.map((stop) => ({ ...stop, kind: 'parada' as const, dwellMinutes: 0 }))
}

export function RoutesPage({ route, template, templates, routes, onSelect, onAction, onUpdateStops, onUpdateService, onRemoveService, onCreate }: Props) {
  const pageSize = 12
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(false)
  const pageCount = Math.max(1, Math.ceil(routes.length / pageSize))
  const selectedIndex = routes.findIndex((item) => item.id === route.id)
  const visibleRoutes = routes.slice((page - 1) * pageSize, page * pageSize)
  const firstRecord = routes.length === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRecord = Math.min(page * pageSize, routes.length)
  const stops = routeStops(route, template)

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

  return <><PageIntro text="Edita el orden y los tiempos de esta ruta diaria sin modificar su plantilla."><Button onClick={onCreate}><CalendarDays /> Crear ruta</Button></PageIntro><div className="route-selector">{visibleRoutes.map((item) => <button type="button" onClick={() => onSelect(item)} className={route.id === item.id ? 'is-selected' : ''} key={item.id}><Route size={16} /><span>{templates.find((current) => current.id === item.templateId)?.name}</span><b>{new Date(`${item.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</b><span className={`status status-${item.status}`}>{statusLabels[item.status]}</span></button>)}</div><Pagination page={page} pageCount={pageCount} firstRecord={firstRecord} lastRecord={lastRecord} total={routes.length} ariaLabel="Paginación de rutas" onChange={setPage} /><Card className="route-journey"><CardContent><div className="journey-header"><div><span className="eyebrow">{route.date}</span><h3>Ruta {template.name}</h3></div><div className="journey-actions"><span className={`status status-${route.status}`}>{statusLabels[route.status]}</span><Button variant="outline" size="sm" onClick={() => setEditing((current) => !current)}>{editing ? 'Terminar edición' : 'Editar itinerario'}</Button></div></div>{editing && <div className="itinerary-toolbar"><span><Clock3 size={15} /> Añade recogidas, entregas o paradas a domicilio. Las nuevas empiezan con 15 min de estancia.</span><Button size="sm" onClick={addStop}><Plus /> Añadir punto</Button></div>}<ol>{stops.map((stop, index) => { const services = route.actions.map((action) => action.stopId ? action : { ...action, stopId: stops.find((candidate) => candidate.locality === action.stop)?.id }).filter((action) => action.stopId === stop.id); return <li key={stop.id}><div className="journey-node">{index + 1}</div><div className="journey-stop"><div className="journey-place"><div><div className="journey-title"><h4>{stop.locality}</h4><span className={`stop-kind stop-kind-${stop.kind}`}>{kindLabels[stop.kind]}</span></div><p>{stop.place}</p><div className="journey-times"><span>Estancia: {stop.dwellMinutes} min</span><span>{index === stops.length - 1 ? 'Fin de ruta' : `Trayecto sig.: ${stop.minutes} min`}</span></div></div>{stop.mapUrl && <a href={stop.mapUrl} target="_blank" rel="noreferrer"><MapPin size={18} /> Abrir mapa</a>}</div>{editing && <StopEditor stop={stop} isFirst={index === 0} isLast={index === stops.length - 1} onChange={(patch) => updateStop(stop.id, patch)} onMove={(direction) => moveStop(index, direction)} onRemove={() => onUpdateStops(route.id, stops.filter((candidate) => candidate.id !== stop.id))} />}{services.length > 0 && <div className="services">{services.map((service) => <ServiceCard key={service.id} action={service} editing={editing} onToggle={() => onAction(service.id)} onChange={(next) => onUpdateService(route.id, next)} onMove={(direction) => moveService(service, direction)} onRemove={() => onRemoveService(route.id, service.id)} />)}</div>}</div></li> })}</ol></CardContent></Card></>
}

function StopEditor({ stop, isFirst, isLast, onChange, onMove, onRemove }: { stop: DailyRouteStop; isFirst: boolean; isLast: boolean; onChange: (patch: Partial<DailyRouteStop>) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  return <div className="stop-editor"><label>Tipo<select value={stop.kind} onChange={(event) => onChange({ kind: event.target.value as DailyStopKind })}><option value="parada">Parada</option><option value="recogida">Recogida</option><option value="entrega">Entrega</option></select></label><label>Localidad o domicilio<Input value={stop.locality} onChange={(event) => onChange({ locality: event.target.value })} /></label><label>Punto / dirección<Input value={stop.place} onChange={(event) => onChange({ place: event.target.value })} /></label><label>Estancia (min)<Input type="number" min="0" value={stop.dwellMinutes} onChange={(event) => onChange({ dwellMinutes: positiveNumber(event.target.value) })} /></label><label>Trayecto siguiente (min)<Input type="number" min="0" value={stop.minutes} onChange={(event) => onChange({ minutes: positiveNumber(event.target.value) })} /></label><div className="stop-editor-actions"><Button variant="outline" size="icon" disabled={isFirst} aria-label="Subir punto" onClick={() => onMove(-1)}><ArrowUp /></Button><Button variant="outline" size="icon" disabled={isLast} aria-label="Bajar punto" onClick={() => onMove(1)}><ArrowDown /></Button><Button variant="outline" size="icon" className="danger-icon" aria-label="Eliminar punto" onClick={onRemove}><Trash2 /></Button></div></div>
}

function ServiceCard({ action, editing, onToggle, onChange, onMove, onRemove }: { action: ServiceAction; editing: boolean; onToggle: () => void; onChange: (action: ServiceAction) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  const done = action.status === 'completada'
  const label = action.type === 'recogida' ? 'Recogida' : 'Entrega'
  return <div className={`service-card ${done ? 'is-done' : ''}`}><div className="service-icon">{action.type === 'recogida' ? <PackageOpen size={18} /> : <PawPrint size={18} />}</div><div><span>{label} · Box {action.box}</span><strong>{action.customer}</strong><a href={`tel:${action.phone.replaceAll(' ', '')}`}><Phone size={13} /> {action.phone}</a>{editing && <label className="service-duration">Tiempo de {label.toLocaleLowerCase()}<Input type="number" min="0" value={action.dwellMinutes ?? 15} onChange={(event) => onChange({ ...action, dwellMinutes: positiveNumber(event.target.value) })} /><span>min</span></label>}</div>{editing ? <div className="service-editor-actions"><Button variant="outline" size="icon" aria-label={`Mover ${label.toLocaleLowerCase()} antes`} onClick={() => onMove(-1)}><ArrowUp /></Button><Button variant="outline" size="icon" aria-label={`Mover ${label.toLocaleLowerCase()} después`} onClick={() => onMove(1)}><ArrowDown /></Button><Button variant="outline" size="icon" className="danger-icon" aria-label={`Eliminar ${label.toLocaleLowerCase()}`} onClick={onRemove}><Trash2 /></Button></div> : <Button variant={done ? 'outline' : 'default'} size="sm" onClick={onToggle}>{done ? 'Deshacer' : action.type === 'recogida' ? 'Recogido' : 'Entregado'}</Button>}</div>
}
