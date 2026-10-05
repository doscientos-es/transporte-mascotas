import { Button, Card, CardContent } from '@doscientos/ui'
import { CalendarDays, FilePlus2, MapPin, Navigation } from 'lucide-react'

import type { UpcomingRoute } from '@/shared/types'

import { formatDate } from '../application/route-maps'

type Props = {
  route: UpcomingRoute
  onDetails: (routeId: string) => void
  onSelect: (routeId: string) => void
}

function routeDateParts(serviceDate: string) {
  const date = new Date(`${serviceDate}T12:00:00`)
  return {
    day: date.toLocaleDateString('es-ES', { day: 'numeric' }),
    month: date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
    weekday: date.toLocaleDateString('es-ES', { weekday: 'long' }),
  }
}

export function UpcomingRouteCard({ route, onDetails, onSelect }: Props) {
  const { day, month, weekday } = routeDateParts(route.serviceDate)
  const stopCount = route.stops.length || route.localities.length

  return (
    <li className="upcoming-route-list-item">
      <Card className="upcoming-route-card">
        <CardContent className="upcoming-route-card-content">
          <div className="upcoming-route-date">
            <CalendarDays size={17} aria-hidden="true" />
            <time
              dateTime={route.serviceDate}
              aria-label={`Salida el ${formatDate(route.serviceDate)}`}
            >
              <strong>{day}</strong>
              <span>{month}</span>
            </time>
            <small>{weekday}</small>
          </div>

          <div className="upcoming-route-summary">
            <div className="upcoming-route-meta">
              <span className="upcoming-route-direction">
                {route.routeDirection === 'inversa' ? 'Sentido inverso' : 'Sentido habitual'}
              </span>
              {stopCount > 0 && (
                <span className="upcoming-route-stop-count">
                  {stopCount} {stopCount === 1 ? 'parada' : 'paradas'}
                </span>
              )}
            </div>
            <h2>{route.templateName || 'Ruta programada'}</h2>
            <div className="upcoming-route-stops">
              <MapPin size={16} aria-hidden="true" />
              <span>{route.localities.join(' · ') || 'Paradas por definir'}</span>
            </div>
          </div>

          <div className="upcoming-route-actions">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="upcoming-route-details"
              aria-label={`Ver recorrido de ${route.templateName || 'la ruta'}`}
              onClick={() => onDetails(route.id)}
            >
              <Navigation size={15} />
              <span className="upcoming-route-details-label">Ver recorrido</span>
              <span className="upcoming-route-details-label-compact" aria-hidden="true">
                Paradas
              </span>
            </Button>
            <Button
              type="button"
              size="sm"
              className="upcoming-route-request"
              aria-label={`Solicitar transporte para ${route.templateName || 'la ruta'}`}
              onClick={() => onSelect(route.id)}
            >
              <FilePlus2 size={15} />
              <span className="upcoming-route-request-label">Solicitar transporte</span>
              <span className="upcoming-route-request-label-compact" aria-hidden="true">
                Solicitar
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  )
}
