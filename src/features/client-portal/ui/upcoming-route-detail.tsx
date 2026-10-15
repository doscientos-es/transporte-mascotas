import { Button, Card, CardContent } from '@doscientos/ui'
import { ArrowLeft, FilePlus2, MapPin, Navigation } from 'lucide-react'
import { lazy, Suspense } from 'react'

import { DEFAULT_ROUTE_START_TIME } from '@/shared/constants/route-defaults'
import { routeDays, routeDaysLabel, routeStopArrivals } from '@/shared/lib/route-days'
import type { UpcomingRoute } from '@/shared/types'

import { approximateArrivalPeriod } from '../application/route-arrival-window'
import { itineraryDirectionsLinks } from '../application/route-maps'

const RouteMap = lazy(() => import('./route-map'))

type Props = {
  route: UpcomingRoute
  onBack: () => void
  onSelect: () => void
}

function routeDateParts(serviceDate: string) {
  const date = new Date(`${serviceDate}T12:00:00`)
  return {
    day: date.toLocaleDateString('es-ES', { day: 'numeric' }),
    month: date.toLocaleDateString('es-ES', { month: 'short' }),
  }
}

function formatStopDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function UpcomingRouteDetail({ route, onBack, onSelect }: Props) {
  const { day, month } = routeDateParts(route.serviceDate)
  const arrivals = routeStopArrivals(
    route.serviceDate,
    route.startTime ?? DEFAULT_ROUTE_START_TIME,
    route.stops,
  )
  const directionsLinks = itineraryDirectionsLinks(route.stops)

  return (
    <div className="upcoming-route-detail">
      <Button type="button" variant="ghost" onClick={onBack} className="mb-4 -ml-2.5">
        <ArrowLeft size={16} /> Volver a próximas rutas
      </Button>
      <Card className="route-journey">
        <CardContent>
          <div className="journey-header route-journey-header">
            <div className="journey-route-title">
              <time className="route-date" dateTime={route.serviceDate}>
                <b>{day}</b>
                <small>{month}</small>
              </time>
              <div>
                <h3>{route.templateName || 'Ruta programada'}</h3>
                {routeDays(route.serviceDate, route.endDate).length > 1 && (
                  <p>{routeDaysLabel(route.serviceDate, route.endDate)}</p>
                )}
                <div className="journey-route-badges">
                  <span className={`route-direction-badge direction-${route.routeDirection}`}>
                    {route.routeDirection === 'inversa' ? 'Sentido inverso' : 'Sentido habitual'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-muted-foreground mt-4 text-sm">
            Las franjas son orientativas. Confirmaremos la hora exacta al cerrar la ruta.
          </p>

          {route.stops.length >= 2 && (
            <section className="upcoming-route-map">
              <Suspense fallback={null}>
                <RouteMap
                  stops={route.stops}
                  label={`Mapa del recorrido de ${route.templateName || 'la ruta'}`}
                />
              </Suspense>
              {directionsLinks.map((link) => (
                <a
                  key={link.url}
                  className="text-accent flex items-center gap-1.5 px-3 py-2 text-xs font-bold hover:underline"
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation size={14} />
                  {directionsLinks.length === 1
                    ? 'Abrir recorrido completo en Google Maps'
                    : `Abrir en Google Maps: paradas ${link.from} a ${link.to}`}
                </a>
              ))}
            </section>
          )}

          <Button type="button" size="lg" className="upcoming-route-cta" onClick={onSelect}>
            <FilePlus2 size={18} /> Solicitar transporte en esta ruta
          </Button>

          <ol className="mt-5">
            {route.stops.map((stop, index) => {
              const arrival = arrivals[index]
              return (
                <li key={stop.id}>
                  <div className="journey-node">{index + 1}</div>
                  <div className="journey-stop">
                    <div className="journey-place">
                      <div>
                        <div className="journey-title">
                          <h4>{stop.locality}</h4>
                        </div>
                        <p>
                          {[stop.street, stop.streetNumber].filter(Boolean).join(' ') || stop.place}
                        </p>
                        {arrival && (
                          <div className="journey-times">
                            <span>
                              Franja aproximada:{' '}
                              <strong>
                                {approximateArrivalPeriod(arrival.time)} ·{' '}
                                {formatStopDate(arrival.date)}
                              </strong>
                            </span>
                          </div>
                        )}
                        {typeof stop.latitude === 'number' &&
                          typeof stop.longitude === 'number' && (
                            <div className="journey-times">
                              <span>
                                {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
                              </span>
                            </div>
                          )}
                      </div>
                      {stop.mapUrl && (
                        <a href={stop.mapUrl} target="_blank" rel="noreferrer">
                          <MapPin size={18} /> Abrir mapa
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
