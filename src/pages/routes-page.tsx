import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowDown, ArrowUp, CalendarDays, Clock3, MapPin, PackageOpen, PawPrint, Pencil, Phone, Plus, Route, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PageIntro } from '../components/page-intro'
import { Pagination } from '../components/pagination'
import { lookupPostalCode, lookupStreetSuggestions, type AddressSuggestion } from '../lib/address-lookup'
import { calculateDrivingTimes } from '../lib/driving-times'
import { statusLabels } from '../lib/status-labels'
import type { DailyRoute, DailyRouteStop, DailyStopKind, Letter, RouteDirection, RouteTemplate, ServiceAction } from '../lib/types'

type Props = { route: DailyRoute; template: RouteTemplate; templates: RouteTemplate[]; routes: DailyRoute[]; letters: Letter[]; onSelect: (route: DailyRoute) => void; onAction: (ids: string[]) => void; onUpdateStops: (routeId: string, stops: DailyRouteStop[], recalculate?: boolean) => Promise<void>; onSuggestStop: (routeId: string, stop: Omit<DailyRouteStop, 'id' | 'kind' | 'mapUrl'>) => Promise<{ index: number; stops: DailyRouteStop[] }>; onAddStop: (routeId: string, stops: DailyRouteStop[]) => Promise<void>; onRemoveStop: (routeId: string, stopId: string) => Promise<void>; onUpdateService: (routeId: string, service: ServiceAction) => void; onRemoveService: (routeId: string, serviceId: string) => void; onCreate: () => void; canManage?: boolean }
type ServiceGroup = { key: string; actions: ServiceAction[]; animalLabels: string[] }

const kindLabels: Record<DailyStopKind, string> = { parada: 'Parada', recogida: 'Recogida', entrega: 'Entrega' }
const directionLabel = (direction: RouteDirection) => direction === 'inversa' ? 'Sentido inverso' : 'Sentido habitual'
const formatDuration = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ''}`.trim() : `${minutes} min`
const routeStops = (route: DailyRoute, template: RouteTemplate) => route.stops ?? template.stops.map((stop) => ({ ...stop, kind: 'parada' as const, dwellMinutes: 15 }))
const mapUrlFor = (stop: Pick<DailyRouteStop, 'alias' | 'street' | 'streetNumber' | 'postalCode' | 'locality' | 'province' | 'country'>) => {
  const address = [[stop.street, stop.streetNumber].filter(Boolean).join(' '), stop.postalCode, stop.locality, stop.province, stop.country || 'España'].filter(Boolean)
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
    const animal = action.animalLabel ?? letters.find((letter) => letter.id === action.letterId)?.animals.find((candidate) => candidate.id === action.animalId)
    const label = typeof animal === 'string' ? animal : animal ? [animal.breed, animal.species].filter(Boolean).join(' · ') : 'Mascota sin identificar'
    if (!group.animalLabels.includes(label)) group.animalLabels.push(label)
    groupsByStop.set(stopId, groups)
  })
  return groupsByStop
}

export function RoutesPage({ route, template, templates, routes, letters, onSelect, onAction, onUpdateStops, onSuggestStop, onAddStop, onRemoveStop, onCreate, canManage = true }: Props) {
  const pageSize = 12
  const [page, setPage] = useState(1)
  const [organizing, setOrganizing] = useState(false)
  const [addingStop, setAddingStop] = useState(false)
  const [plannedStops, setPlannedStops] = useState<DailyRouteStop[] | null>(null)
  const [savingPlan, setSavingPlan] = useState(false)
  const [deletingStop, setDeletingStop] = useState<DailyRouteStop | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingStop, setEditingStop] = useState<DailyRouteStop | null>(null)
  const selectedIndex = routes.findIndex((item) => item.id === route.id)
  const pageCount = Math.max(1, Math.ceil(routes.length / pageSize))
  const visibleRoutes = routes.slice((page - 1) * pageSize, page * pageSize)
  const stops = plannedStops ?? routeStops(route, template)
  const direction = route.direction ?? 'normal'
  const servicesByStop = useMemo(() => groupedServices(route, stops, letters), [route, stops, letters])
  const travelMinutes = stops.slice(0, -1).reduce((total, stop) => total + stop.minutes, 0)
  const pointMinutes = stops.reduce((total, stop) => total + stop.dwellMinutes, 0)
  const arrivalByStop = new Map<string, number>()
  let elapsedMinutes = 0
  stops.forEach((stop, index) => { arrivalByStop.set(stop.id, elapsedMinutes); elapsedMinutes += stop.dwellMinutes + (index < stops.length - 1 ? stop.minutes : 0) })

  useEffect(() => { setPage((current) => Math.min(current, pageCount)) }, [pageCount])
  useEffect(() => { if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / pageSize) + 1) }, [selectedIndex])
  useEffect(() => { setOrganizing(false); setPlannedStops(null) }, [route.id])

  function moveStop(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= stops.length) return; const next = [...stops]; [next[index], next[target]] = [next[target], next[index]]; void onUpdateStops(route.id, next) }
  async function movePlannedStop(index: number, direction: -1 | 1) { if (!plannedStops) return; const target = index + direction; if (target < 0 || target >= plannedStops.length) return; const next = [...plannedStops]; [next[index], next[target]] = [next[target], next[index]]; try { setPlannedStops(await calculateDrivingTimes(next)) } catch { setPlannedStops(next) } }
  function setDwellMinutes(index: number, value: string) { const dwellMinutes = Math.max(0, Number(value) || 0); const next = stops.map((stop, stopIndex) => stopIndex === index ? { ...stop, dwellMinutes } : stop); if (plannedStops) setPlannedStops(next); else void onUpdateStops(route.id, next, false) }
  async function acceptPlan() { if (!plannedStops) return; setSavingPlan(true); try { await onAddStop(route.id, plannedStops); setPlannedStops(null) } finally { setSavingPlan(false) } }
  async function removeStop() { if (!deletingStop) return; setDeleting(true); try { await onRemoveStop(route.id, deletingStop.id); setDeletingStop(null) } finally { setDeleting(false) } }
  async function saveEditedStop(values: Omit<DailyRouteStop, 'id' | 'kind' | 'mapUrl'>) { if (!editingStop) return; const updated = { ...editingStop, ...values, mapUrl: mapUrlFor(values) }; await onUpdateStops(route.id, stops.map((stop) => stop.id === editingStop.id ? updated : stop)); setEditingStop(null) }

  return <>
    <PageIntro text={canManage ? `Organiza las paradas y sus tiempos · ${directionLabel(direction)}.` : `Consulta el itinerario asignado · ${directionLabel(direction)}.`}>{canManage && <Button onClick={onCreate}><CalendarDays /> Crear ruta</Button>}</PageIntro>
    <div className="route-selector">{visibleRoutes.map((item) => <button type="button" onClick={() => onSelect(item)} className={route.id === item.id ? 'is-selected' : ''} key={item.id}><Route size={16} /><span>{templates.find((current) => current.id === item.templateId)?.name}<small>{directionLabel(item.direction ?? 'normal')}</small></span><b>{new Date(`${item.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</b><span className={`status status-${item.status}`}>{statusLabels[item.status]}</span></button>)}</div>
    <Pagination page={page} pageCount={pageCount} firstRecord={routes.length === 0 ? 0 : (page - 1) * pageSize + 1} lastRecord={Math.min(page * pageSize, routes.length)} total={routes.length} ariaLabel="Paginación de rutas" onChange={setPage} />
    <Card className="route-journey"><CardContent>
      <div className="journey-header"><div><span className="eyebrow">{route.date}</span><h3>Ruta {template.name}</h3><span className={`route-direction-badge direction-${direction}`}>{directionLabel(direction)}</span></div><div className="journey-actions"><div className="route-total"><Clock3 size={16} /><span>Estimación total</span><strong>{formatDuration(travelMinutes + pointMinutes)}</strong><small>{formatDuration(travelMinutes)} trayectos · {formatDuration(pointMinutes)} paradas</small></div><span className={`status status-${route.status}`}>{statusLabels[route.status]}</span>{canManage && <Button variant="outline" size="sm" onClick={() => setAddingStop(true)} disabled={Boolean(plannedStops)}><Plus /> Añadir parada</Button>}{canManage && <Button variant="outline" size="sm" onClick={() => setOrganizing((current) => !current)}>{organizing ? 'Terminar' : 'Organizar paradas'}</Button>}</div></div>
      {plannedStops && <div className="itinerary-toolbar"><span><Clock3 size={15} /> Posición sugerida por cercanía y tiempo en coche. Muévela si lo necesitas antes de guardarla.</span><Button size="sm" variant="outline" onClick={() => setPlannedStops(null)} disabled={savingPlan}>Cancelar</Button><Button size="sm" onClick={() => void acceptPlan()} disabled={savingPlan}>{savingPlan ? 'Guardando…' : 'Aceptar posición'}</Button></div>}
      {organizing && !plannedStops && <div className="itinerary-toolbar"><span><Clock3 size={15} /> Los trayectos se recalculan en coche al cambiar el orden. Ajusta los minutos de espera.</span></div>}
      <ol>{stops.map((stop, index) => <JourneyStop key={stop.id} stop={stop} index={index} total={stops.length} arrival={formatArrival(route.date, arrivalByStop.get(stop.id) ?? 0)} organizing={organizing || Boolean(plannedStops)} services={servicesByStop.get(stop.id) ?? []} onMove={plannedStops ? movePlannedStop : moveStop} onDwellChange={setDwellMinutes} onEdit={plannedStops ? undefined : () => setEditingStop(stop)} onDelete={plannedStops ? undefined : () => setDeletingStop(stop)} onAction={onAction} />)}</ol>
    </CardContent></Card>
    {addingStop && <AddStopDialog onClose={() => setAddingStop(false)} onAdd={async (stop) => { const plan = await onSuggestStop(route.id, stop); setPlannedStops(plan.stops); setAddingStop(false) }} />}
    {editingStop && <AddStopDialog initialStop={editingStop} onClose={() => setEditingStop(null)} onAdd={saveEditedStop} />}
    <AlertDialog open={deletingStop !== null} onOpenChange={(open) => { if (!open) setDeletingStop(null) }}><AlertDialogContent className="!w-[calc(100%-2.5rem)] !max-w-[460px] !p-[26px]"><AlertDialogHeader><AlertDialogTitle>Eliminar parada</AlertDialogTitle><AlertDialogDescription>{deletingStop ? `¿Eliminar la parada de ${deletingStop.locality}? Se recalcularán los trayectos restantes.` : ''}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleting} onClick={() => void removeStop()}><Trash2 /> {deleting ? 'Eliminando…' : 'Eliminar parada'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>
}

function AddStopDialog({ initialStop, onClose, onAdd }: { initialStop?: DailyRouteStop; onClose: () => void; onAdd: (stop: Omit<DailyRouteStop, 'id' | 'kind' | 'mapUrl'>) => Promise<void> }) {
  const [locality, setLocality] = useState(initialStop?.locality ?? '')
  const [postalCode, setPostalCode] = useState(initialStop?.postalCode ?? '')
  const [province, setProvince] = useState(initialStop?.province ?? '')
  const [country, setCountry] = useState(initialStop?.country ?? 'España')
  const [street, setStreet] = useState(initialStop?.street ?? '')
  const [streetNumber, setStreetNumber] = useState(initialStop?.streetNumber ?? '')
  const [floor, setFloor] = useState(initialStop?.floor ?? '')
  const [alias, setAlias] = useState(initialStop?.alias ?? '')
  const [place, setPlace] = useState(initialStop?.place ?? '')
  const [dwellMinutes, setDwellMinutes] = useState(String(initialStop?.dwellMinutes ?? 15))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lookingUpPostcode, setLookingUpPostcode] = useState(false)
  const [streetSuggestions, setStreetSuggestions] = useState<AddressSuggestion[]>([])

  useEffect(() => {
    if (!/^\d{5}$/.test(postalCode.trim())) return
    const controller = new AbortController()
    setLookingUpPostcode(true)
    lookupPostalCode(postalCode.trim(), controller.signal).then((address) => {
      setLocality(address.locality); setProvince(address.province); setCountry(address.country)
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError('No se ha podido identificar el código postal. Puedes completar los datos manualmente.')
    }).finally(() => setLookingUpPostcode(false))
    return () => controller.abort()
  }, [postalCode])

  useEffect(() => {
    if (street.trim().length < 3 || !locality.trim() || !/^\d{5}$/.test(postalCode.trim())) { setStreetSuggestions([]); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      lookupStreetSuggestions(street.trim(), locality.trim(), postalCode.trim(), controller.signal).then(setStreetSuggestions).catch(() => setStreetSuggestions([]))
    }, 400)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [street, locality, postalCode])

  function selectStreet(suggestion: AddressSuggestion) {
    setStreet(suggestion.street); setStreetNumber(suggestion.streetNumber || streetNumber); setAlias(suggestion.alias || alias)
    setLocality(suggestion.locality || locality); setPostalCode(suggestion.postalCode || postalCode); setProvince(suggestion.province || province); setCountry(suggestion.country || country)
    setStreetSuggestions([])
  }
  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault(); setSaving(true); setError('')
    try { await onAdd({ locality: locality.trim(), postalCode: postalCode.trim(), province: province.trim(), country: country.trim() || 'España', street: street.trim(), streetNumber: streetNumber.trim(), floor: floor.trim(), alias: alias.trim(), place: place.trim(), dwellMinutes: Math.max(0, Number(dwellMinutes) || 0), minutes: 0 }) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se ha podido añadir la parada.') } finally { setSaving(false) }
  }
  const editing = Boolean(initialStop)
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="dialog-card !w-[calc(100%-2.5rem)] !max-w-[590px] !p-[26px]"><DialogHeader className="gap-0"><DialogTitle>{editing ? 'Editar parada' : 'Añadir parada'}</DialogTitle><DialogDescription>Escribe primero el código postal para completar la ubicación y buscar calles disponibles.</DialogDescription></DialogHeader><form className="client-form" onSubmit={submit}><Label>Código postal<Input value={postalCode} onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" required autoFocus />{lookingUpPostcode && <small>Buscando localidad…</small>}</Label><Label>Localidad<Input value={locality} onChange={(event) => setLocality(event.target.value)} required /></Label><Label>Provincia<Input value={province} onChange={(event) => setProvince(event.target.value)} required /></Label><Label>País<Input value={country} onChange={(event) => setCountry(event.target.value)} required /></Label><Label>Alias o negocio<Input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="Ej. Repsol Norte" /></Label><div className="street-field"><Label>Vía / calle<Input value={street} onChange={(event) => setStreet(event.target.value)} autoComplete="off" required /></Label>{streetSuggestions.length > 0 && <div className="street-suggestions" role="listbox" aria-label="Calles disponibles">{streetSuggestions.map((suggestion) => <button type="button" role="option" key={`${suggestion.street}-${suggestion.streetNumber}-${suggestion.alias}`} onClick={() => selectStreet(suggestion)}><strong>{suggestion.street}{suggestion.streetNumber ? `, ${suggestion.streetNumber}` : ''}</strong><span>{[suggestion.alias, suggestion.locality, suggestion.postalCode].filter(Boolean).join(' · ')}</span></button>)}</div>}</div><Label>Número<Input value={streetNumber} onChange={(event) => setStreetNumber(event.target.value)} required /></Label><Label>Piso, portal o local<Input value={floor} onChange={(event) => setFloor(event.target.value)} placeholder="Opcional" /></Label><Label className="form-span">Indicaciones o punto de encuentro<Input value={place} onChange={(event) => setPlace(event.target.value)} placeholder="Ej. aparcamiento lateral" /></Label><Label>Espera en la parada (min)<Input type="number" min="0" step="5" value={dwellMinutes} onChange={(event) => setDwellMinutes(event.target.value)} /></Label>{error && <p className="form-error form-span" role="alert">{error}</p>}<Button className="dialog-submit form-span" type="submit" disabled={saving}><Pencil /> {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Añadir parada'}</Button></form></DialogContent></Dialog>
}

function JourneyStop({ stop, index, total, arrival, organizing, services, onMove, onDwellChange, onEdit, onDelete, onAction }: { stop: DailyRouteStop; index: number; total: number; arrival: string; organizing: boolean; services: ServiceGroup[]; onMove: (index: number, direction: -1 | 1) => void; onDwellChange: (index: number, value: string) => void; onEdit?: () => void; onDelete?: () => void; onAction: (ids: string[]) => void }) {
  const hasServices = services.length > 0
  return <li><div className="journey-node">{index + 1}</div><div className="journey-stop"><div className="journey-place"><div><div className="journey-title"><h4>{stop.locality}</h4><span className={`stop-kind stop-kind-${stop.kind}`}>{kindLabels[stop.kind]}</span></div><p>{stop.place}</p><div className="journey-times"><span className="arrival-time">Llegada aprox.: <strong>{arrival}</strong></span><span>Espera: {formatDuration(stop.dwellMinutes)}</span><span>{index === total - 1 ? 'Fin de ruta' : `Trayecto sig.: ${formatDuration(stop.minutes)}`}</span></div></div>{stop.mapUrl && <a href={stop.mapUrl} target="_blank" rel="noreferrer"><MapPin size={18} /> Abrir mapa</a>}</div>{organizing && <div className="stop-planner"><label>Espera en esta parada <Input type="number" min="0" step="5" inputMode="numeric" value={stop.dwellMinutes} onChange={(event) => onDwellChange(index, event.target.value)} /><span>min</span></label><div className="stop-move-actions"><Button variant="outline" size="sm" disabled={index === 0} aria-label={`Subir ${stop.locality}`} onClick={() => onMove(index, -1)}><ArrowUp /> Subir</Button><Button variant="outline" size="sm" disabled={index === total - 1} aria-label={`Bajar ${stop.locality}`} onClick={() => onMove(index, 1)}><ArrowDown /> Bajar</Button>{onEdit && <Button variant="outline" size="sm" aria-label={`Editar ${stop.locality}`} onClick={onEdit}><Pencil /> Editar</Button>}{onDelete && <Button variant="outline" size="sm" disabled={hasServices} title={hasServices ? 'No se puede eliminar una parada con recogidas o entregas asociadas.' : `Eliminar ${stop.locality}`} aria-label={`Eliminar ${stop.locality}`} onClick={onDelete}><Trash2 /> Eliminar</Button>}</div></div>}{services.length > 0 && <div className="services">{services.map((group) => <ServiceCard key={group.key} group={group} onToggle={() => onAction(group.actions.map((action) => action.id))} />)}</div>}</div></li>
}

function ServiceCard({ group, onToggle }: { group: ServiceGroup; onToggle: () => void }) {
  const action = group.actions[0]
  const done = group.actions.every((item) => item.status === 'completada')
  const label = action.type === 'recogida' ? 'Recogida' : 'Entrega'
  const animalCount = group.actions.length
  const animalSummary = animalCount === 1 ? group.animalLabels[0] : `${animalCount} animales · ${group.animalLabels.join(' + ')}`
  return <div className={`service-card ${done ? 'is-done' : ''}`}><div className="service-icon">{action.type === 'recogida' ? <PackageOpen size={18} /> : <PawPrint size={18} />}</div><div><span>{label} · {action.box ? `Box ${action.box}` : 'Sin box'} · {animalCount} {animalCount === 1 ? 'animal' : 'animales'}</span><strong>{animalSummary}</strong><span className="service-customer">{action.customer}</span><a href={`tel:${action.phone.replaceAll(' ', '')}`}><Phone size={13} /> {action.phone}</a></div><Button variant={done ? 'outline' : 'default'} size="sm" onClick={onToggle}>{done ? 'Deshacer' : action.type === 'recogida' ? 'Recogido' : 'Entregado'}</Button></div>
}
