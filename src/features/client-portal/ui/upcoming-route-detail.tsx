import { Button, Card, CardContent } from '@doscientos/ui'
import { ArrowLeft, FilePlus2, MapPin, Navigation } from 'lucide-react'

import type { UpcomingRoute } from '@/shared/types'

import { itineraryDirectionsUrl, itineraryEmbedUrl } from '../application/route-maps'

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

export function UpcomingRouteDetail({ route, onBack, onSelect }: Props) {
  const { day, month } = routeDateParts(route.serviceDate)
  const embedUrl = itineraryEmbedUrl(route.stops)
  const directionsUrl = itineraryDirectionsUrl(route.stops)

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
                <span className="eyebrow">Salida programada</span>
                <h3>{route.templateName || 'Ruta programada'}</h3>
                <div className="journey-route-badges">
                  <span className={`route-direction-badge direction-${route.routeDirection}`}>
                    {route.routeDirection === 'inversa' ? 'Sentido inverso' : 'Sentido habitual'}
                  </span>
                </div>
              </div>
            </div>
            <div className="journey-actions">
              <Button type="button" onClick={onSelect}>
                <FilePlus2 size={16} /> Seleccionar
              </Button>
            </div>
          </div>

          {embedUrl && (
            <section className="border-border bg-card mt-5 overflow-hidden rounded-xl border">
              <iframe
                className="h-64 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer"
                src={embedUrl}
                title={`Mapa del recorrido de ${route.templateName || 'la ruta'}`}
              />
              {directionsUrl && (
                <a
                  className="text-accent flex items-center gap-1.5 px-3 py-2 text-xs font-bold hover:underline"
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation size={14} /> Abrir recorrido completo en Google Maps
                </a>
              )}
            </section>
          )}

          <ol className="mt-5">
            {route.stops.map((stop, index) => (
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
                      {typeof stop.latitude === 'number' && typeof stop.longitude === 'number' && (
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
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
