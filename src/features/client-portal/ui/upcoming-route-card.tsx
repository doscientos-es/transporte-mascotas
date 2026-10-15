import { Button } from '@doscientos/ui'
import { CalendarDays, FilePlus2, MapPin, Navigation } from 'lucide-react'
import { lazy, Suspense } from 'react'

import { routeDays, routeDaysLabel } from '@/shared/lib/route-days'
import type { UpcomingRoute } from '@/shared/types'

import { formatDate } from '../application/route-maps'

const RouteMap = lazy(() => import('./route-map'))

type Props = {
  route: UpcomingRoute
  onDetails: (routeId: string) => void
  onSelect: (routeId: string) => void
}

function shortDate(isoDate: string, withMonth: boolean) {
  const date = new Date(`${isoDate}T12:00:00Z`)
  const day = date.getUTCDate()
  if (!withMonth) return String(day)
  const month = date
    .toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' })
    .replace('.', '')
  return `${day} ${month}`
}

/** "mar, 6 oct" for one day, "20 – 23 oct" or "30 oct – 2 nov" for a multi-day route. */
function routeDateRange(serviceDate: string, endDate?: string | null) {
  const days = routeDays(serviceDate, endDate)
  const first = days[0]
  const last = days[days.length - 1]
  if (days.length === 1) {
    const weekday = new Date(`${first}T12:00:00Z`)
      .toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'UTC' })
      .replace('.', '')
    return `${weekday}, ${shortDate(first, true)}`
  }
  const sameMonth = first.slice(0, 7) === last.slice(0, 7)
  return `${shortDate(first, !sameMonth)} – ${shortDate(last, true)}`
}

export function UpcomingRouteCard({ route, onDetails, onSelect }: Props) {
  const stopCount = route.stops.length || route.localities.length
  const days = routeDays(route.serviceDate, route.endDate).length
  const localities = [...new Set(route.localities)]
  const name = route.templateName || 'Ruta programada'

  return (
    <li className="urc-item">
      <article className="urc">
        <div className="urc-main">
          <time
            className="urc-date"
            dateTime={route.serviceDate}
            aria-label={
              days > 1
                ? `Ruta del ${routeDaysLabel(route.serviceDate, route.endDate)}`
                : `Salida el ${formatDate(route.serviceDate)}`
            }
          >
            <CalendarDays size={15} aria-hidden="true" />
            {routeDateRange(route.serviceDate, route.endDate)}
          </time>
          <h2>{name}</h2>
          <div className="urc-tags">
            <span>
              {route.routeDirection === 'inversa' ? 'Sentido inverso' : 'Sentido habitual'}
            </span>
            {days > 1 && <span>{days} días</span>}
            {stopCount > 0 && (
              <span>
                {stopCount} {stopCount === 1 ? 'parada' : 'paradas'}
              </span>
            )}
          </div>
        </div>

        <div className="urc-stops">
          <span className="urc-stops-label">
            <MapPin size={14} aria-hidden="true" /> Paradas
          </span>
          {localities.length ? (
            <ol>
              {localities.map((locality) => (
                <li key={locality}>{locality}</li>
              ))}
            </ol>
          ) : (
            <span className="urc-stops-empty">Por definir</span>
          )}
        </div>

        <div className="urc-actions">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Ver recorrido de ${name}`}
            onClick={() => onDetails(route.id)}
          >
            <Navigation size={15} /> Ver recorrido
          </Button>
          <Button
            type="button"
            size="sm"
            aria-label={`Solicitar transporte para ${name}`}
            onClick={() => onSelect(route.id)}
          >
            <FilePlus2 size={15} /> Solicitar transporte
          </Button>
        </div>

        {route.stops.length >= 2 && (
          <div className="urc-map">
            <Suspense fallback={null}>
              <RouteMap stops={route.stops} label={`Mapa del recorrido de ${name}`} />
            </Suspense>
          </div>
        )}
      </article>
    </li>
  )
}
