import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ArrowDown, ArrowUp, CalendarDays, Clock3, MapPin, PackageOpen, PawPrint, Phone, Route } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PageIntro } from '../components/page-intro'
import { Pagination } from '../components/pagination'
import { statusLabels } from '../lib/status-labels'
import type { DailyRoute, DailyRouteStop, DailyStopKind, Letter, RouteTemplate, ServiceAction } from '../lib/types'

type Props = { route: DailyRoute; template: RouteTemplate; templates: RouteTemplate[]; routes: DailyRoute[]; letters: Letter[]; onSelect: (route: DailyRoute) => void; onAction: (ids: string[]) => void; onUpdateStops: (routeId: string, stops: DailyRouteStop[]) => void; onUpdateService: (routeId: string, service: ServiceAction) => void; onRemoveService: (routeId: string, serviceId: string) => void; onCreate: () => void; canManage?: boolean }
type ServiceGroup = { key: string; actions: ServiceAction[]; animalLabels: string[] }
const kindLabels: Record<DailyStopKind, string> = { parada: 'Parada', recogida: 'Recogida', entrega: 'Entrega' }
const formatDuration = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ''}`.trim() : `${minutes} min`

function routeStops(route: DailyRoute, template: RouteTemplate) { return route.stops ?? template.stops.map((stop) => ({ ...stop, kind: 'parada' as const, dwellMinutes: 15 })) }
function formatArrival(date: string, offsetMinutes: number) { const departure = new Date(`${date}T08:00:00`); departure.setMinutes(departure.getMinutes() + offsetMinutes); return departure.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }

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
    const animal = action.animalLabel ?? letters.find((letter) => letter.id === action.letterId)?.animals.find((candidate) => candidate.id === action.animalId)
    const label = typeof animal === 'string' ? animal : animal ? [animal.breed, animal.species].filter(Boolean).join(' · ') : 'Mascota sin identificar'
    if (!group.animalLabels.includes(label)) group.animalLabels.push(label)
    groupsByStop.set(stopId, groups)
  })
  return groupsByStop
}

export function RoutesPage({ route, template, templates, routes, letters, onSelect, onAction, onUpdateStops, onUpdateService, onRemoveService, onCreate, canManage = true }: Props) {
  const [page, setPage] = useState(1); const [organizing, setOrganizing] = useState(false); const pageSize = 12
  const selectedIndex = routes.findIndex((item) => item.id === route.id); const pageCount = Math.max(1, Math.ceil(routes.length / pageSize)); const visibleRoutes = routes.slice((page - 1) * pageSize, page * pageSize)
  const stops = routeStops(route, template); const groupsByStop = useMemo(() => groupedServices(route, stops, letters), [route, stops, letters]); const travelMinutes = stops.slice(0, -1).reduce((total, stop) => total + stop.minutes, 0); const pointMinutes = stops.reduce((total, stop) => total + stop.dwellMinutes, 0)
  const arrivalByStop = new Map<string, number>(); let elapsedMinutes = 0; stops.forEach((stop, index) => { arrivalByStop.set(stop.id, elapsedMinutes); elapsedMinutes += stop.dwellMinutes + (index < stops.length - 1 ? stop.minutes : 0) })
  useEffect(() => { setPage((current) => Math.min(current, pageCount)) }, [pageCount]); useEffect(() => { if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / pageSize) + 1) }, [selectedIndex]); useEffect(() => { setOrganizing(false) }, [route.id])
  const moveStop = (index: number, direction: -1 | 1) => { const target = index + direction; if (target < 0 || target >= stops.length) return; const next = [...stops]; [next[index], next[target]] = [next[target], next[index]]; onUpdateStops(route.id, next) }
  const setDwellMinutes = (index: number, value: string) => { const dwellMinutes = Math.max(0, Number(value) || 0); onUpdateStops(route.id, stops.map((stop, stopIndex) => stopIndex === index ? { ...stop, dwellMinutes } : stop)) }
  return <><PageIntro text={canManage ? 'Organiza las paradas y ajusta el tiempo de cada cambio de perros.' : 'Consulta el itinerario asignado y registra las recogidas y entregas realizadas.'}>{canManage && <Button onClick={onCreate}><CalendarDays /> Crear ruta</Button>}</PageIntro><div className="route-selector">{visibleRoutes.map((item) => <button type="button" onClick={() => onSelect(item)} className={route.id === item.id ? 'is-selected' : ''} key={item.id}><Route size={16} /><span>{templates.find((current) => current.id === item.templateId)?.name}</span><b>{new Date(`${item.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</b><span className={`status status-${item.status}`}>{statusLabels[item.status]}</span></button>)}</div><Pagination page={page} pageCount={pageCount} firstRecord={routes.length === 0 ? 0 : (page - 1) * pageSize + 1} lastRecord={Math.min(page * pageSize, routes.length)} total={routes.length} ariaLabel="Paginación de rutas" onChange={setPage} /><Card className="route-journey"><CardContent><div className="journey-header"><div><span className="eyebrow">{route.date}</span><h3>Ruta {template.name}</h3></div><div className="journey-actions"><div className="route-total"><Clock3 size={16} /><span>Estimación total</span><strong>{formatDuration(travelMinutes + pointMinutes)}</strong><small>{formatDuration(travelMinutes)} trayectos · {formatDuration(pointMinutes)} paradas</small></div><span className={`status status-${route.status}`}>{statusLabels[route.status]}</span>{canManage && <Button variant="outline" size="sm" onClick={() => setOrganizing((current) => !current)}>{organizing ? 'Terminar' : 'Organizar paradas'}</Button>}</div></div>{organizing && <div className="itinerary-toolbar"><span><Clock3 size={15} /> Salida estimada a las 08:00. Usa las flechas y ajusta los minutos de espera.</span></div>}<ol>{stops.map((stop, index) => <JourneyStop key={stop.id} stop={stop} index={index} total={stops.length} arrival={formatArrival(route.date, arrivalByStop.get(stop.id) ?? 0)} organizing={organizing} services={groupsByStop.get(stop.id) ?? []} onMove={moveStop} onDwellChange={setDwellMinutes} onAction={onAction} onUpdateService={onUpdateService} onRemoveService={onRemoveService} routeId={route.id} />)}</ol></CardContent></Card></>
}

function JourneyStop({ stop, index, total, arrival, organizing, services, onMove, onDwellChange, onAction, onUpdateService, onRemoveService, routeId }: { stop: DailyRouteStop; index: number; total: number; arrival: string; organizing: boolean; services: ServiceGroup[]; onMove: (index: number, direction: -1 | 1) => void; onDwellChange: (index: number, value: string) => void; onAction: (ids: string[]) => void; onUpdateService: (routeId: string, service: ServiceAction) => void; onRemoveService: (routeId: string, serviceId: string) => void; routeId: string }) {
  return <li><div className="journey-node">{index + 1}</div><div className="journey-stop"><div className="journey-place"><div><div className="journey-title"><h4>{stop.locality}</h4><span className={`stop-kind stop-kind-${stop.kind}`}>{kindLabels[stop.kind]}</span></div><p>{stop.place}</p><div className="journey-times"><span className="arrival-time">Llegada aprox.: <strong>{arrival}</strong></span><span>Espera: {formatDuration(stop.dwellMinutes)}</span><span>{index === total - 1 ? 'Fin de ruta' : `Trayecto sig.: ${formatDuration(stop.minutes)}`}</span></div></div>{stop.mapUrl && <a href={stop.mapUrl} target="_blank" rel="noreferrer"><MapPin size={18} /> Abrir mapa</a>}</div>{organizing && <div className="stop-planner"><label>Espera en esta parada <Input type="number" min="0" step="5" inputMode="numeric" value={stop.dwellMinutes} onChange={(event) => onDwellChange(index, event.target.value)} /><span>min</span></label><div className="stop-move-actions"><Button variant="outline" size="sm" disabled={index === 0} aria-label={`Subir ${stop.locality}`} onClick={() => onMove(index, -1)}><ArrowUp /> Subir</Button><Button variant="outline" size="sm" disabled={index === total - 1} aria-label={`Bajar ${stop.locality}`} onClick={() => onMove(index, 1)}><ArrowDown /> Bajar</Button></div></div>}{services.length > 0 && <div className="services">{services.map((group) => <ServiceCard key={group.key} group={group} onToggle={() => onAction(group.actions.map((action) => action.id))} onRemove={() => group.actions.forEach((action) => onRemoveService(routeId, action.id))} onUpdate={(service) => onUpdateService(routeId, service)} />)}</div>}</div></li>
}

function ServiceCard({ group, onToggle }: { group: ServiceGroup; onToggle: () => void; onRemove: () => void; onUpdate: (service: ServiceAction) => void }) {
  const action = group.actions[0]; const done = group.actions.every((item) => item.status === 'completada'); const label = action.type === 'recogida' ? 'Recogida' : 'Entrega'; const animalCount = group.actions.length; const animalSummary = animalCount === 1 ? group.animalLabels[0] : `${animalCount} animales · ${group.animalLabels.join(' + ')}`
  return <div className={`service-card ${done ? 'is-done' : ''}`}><div className="service-icon">{action.type === 'recogida' ? <PackageOpen size={18} /> : <PawPrint size={18} />}</div><div><span>{label} · {action.box ? `Box ${action.box}` : 'Sin box'} · {animalCount} {animalCount === 1 ? 'animal' : 'animales'}</span><strong>{animalSummary}</strong><span className="service-customer">{action.customer}</span><a href={`tel:${action.phone.replaceAll(' ', '')}`}><Phone size={13} /> {action.phone}</a></div><Button variant={done ? 'outline' : 'default'} size="sm" onClick={onToggle}>{done ? 'Deshacer' : action.type === 'recogida' ? 'Recogido' : 'Entregado'}</Button></div>
}