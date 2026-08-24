import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, MapPin, PackageOpen, PawPrint, Phone, Route } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageIntro } from '../components/page-intro'
import { Pagination } from '../components/pagination'
import { statusLabels } from '../lib/status-labels'
import type { DailyRoute, RouteTemplate, ServiceAction } from '../lib/types'

type Props = {
  route: DailyRoute
  template: RouteTemplate
  templates: RouteTemplate[]
  routes: DailyRoute[]
  onSelect: (route: DailyRoute) => void
  onAction: (id: string) => void
  onCreate: () => void
  onPublish: (id: string, published: boolean) => void
}

export function RoutesPage({ route, template, templates, routes, onSelect, onAction, onCreate, onPublish }: Props) {
  const pageSize = 12
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(routes.length / pageSize))
  const selectedIndex = routes.findIndex((item) => item.id === route.id)
  const visibleRoutes = routes.slice((page - 1) * pageSize, page * pageSize)
  const firstRecord = routes.length === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRecord = Math.min(page * pageSize, routes.length)

  useEffect(() => { setPage((current) => Math.min(current, pageCount)) }, [pageCount])
  useEffect(() => { if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / pageSize) + 1) }, [selectedIndex])

  return <><PageIntro text="La ruta incluye todas las paradas de la plantilla y los servicios del día."><Button onClick={onCreate}><CalendarDays /> Crear ruta</Button></PageIntro><div className="route-selector">{visibleRoutes.map((item) => <button type="button" onClick={() => onSelect(item)} className={route.id === item.id ? 'is-selected' : ''} key={item.id}><Route size={16} /><span>{templates.find((current) => current.id === item.templateId)?.name}</span><b>{new Date(`${item.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</b><span className={`status status-${item.status}`}>{statusLabels[item.status]}</span></button>)}</div><Pagination page={page} pageCount={pageCount} firstRecord={firstRecord} lastRecord={lastRecord} total={routes.length} ariaLabel="Paginación de rutas" onChange={setPage} /><Card className="route-journey"><CardContent><div className="journey-header"><div><span className="eyebrow">{route.date}</span><h3>Ruta {template.name}</h3></div><div className="flex items-center gap-2"><span className="status status-activa">{statusLabels[route.status]}</span><Button size="sm" variant={route.published ? 'outline' : 'default'} onClick={() => onPublish(route.id, !route.published)}>{route.published ? 'Retirar de reservas' : 'Publicar ruta'}</Button></div></div><ol>{template.stops.map((stop, index) => { const actions = route.actions.filter((action) => action.stop === stop.locality); return <li key={`${stop.id}-${index}`}><div className="journey-node">{index + 1}</div><div className="journey-stop"><div className="journey-place"><div><h4>{stop.locality}</h4><p>{stop.place}</p></div><a href={stop.mapUrl} target="_blank" rel="noreferrer"><MapPin size={18} /> Abrir mapa</a></div>{actions.length > 0 && <div className="services">{actions.map((action) => <ServiceCard key={action.id} action={action} onToggle={() => onAction(action.id)} />)}</div>}</div></li> })}</ol></CardContent></Card></>
}

function ServiceCard({ action, onToggle }: { action: ServiceAction; onToggle: () => void }) {
  const done = action.status === 'completada'
  return <div className={`service-card ${done ? 'is-done' : ''}`}><div className="service-icon">{action.type === 'recogida' ? <PackageOpen size={18} /> : <PawPrint size={18} />}</div><div><span>{action.type === 'recogida' ? 'Recogida' : 'Entrega'} · Box {action.box}</span><strong>{action.customer}</strong><a href={`tel:${action.phone.replaceAll(' ', '')}`}><Phone size={13} /> {action.phone}</a></div><Button variant={done ? 'outline' : 'default'} size="sm" onClick={onToggle}>{done ? 'Deshacer' : action.type === 'recogida' ? 'Recogido' : 'Entregado'}</Button></div>
}
