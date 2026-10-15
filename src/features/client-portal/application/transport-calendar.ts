import { DEFAULT_ROUTE_START_TIME } from '@/shared/constants/route-defaults'
import { routeStopArrivals } from '@/shared/lib/route-days'
import type { RouteStop, TransportRequest } from '@/shared/types'

type CalendarRequest = Pick<
  TransportRequest,
  'id' | 'origin' | 'destination' | 'desiredDate' | 'animals'
>

export const isConfirmedTransport = (status: TransportRequest['status']) =>
  status === 'confirmada' || status === 'en_ruta' || status === 'entregada'

const madridParts = (now: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  }
}

/**
 * Status shown to the client. A confirmed request moves to `en_ruta` once the departure
 * moment (Europe/Madrid) has passed and to `entregada` once the last route day has passed.
 */
export function displayTransportStatus(
  request: Pick<TransportRequest, 'status' | 'desiredDate'>,
  now: Date,
  route?: { startTime?: string; endDate?: string },
): TransportRequest['status'] {
  if (request.status !== 'confirmada' && request.status !== 'en_ruta') return request.status
  const today = madridParts(now)
  const lastDay =
    route?.endDate && route.endDate > request.desiredDate ? route.endDate : request.desiredDate
  if (today.date > lastDay) return 'entregada'
  const departure = route?.startTime ?? '08:00'
  if (
    today.date > request.desiredDate ||
    (today.date === request.desiredDate && today.time >= departure)
  )
    return 'en_ruta'
  return request.status
}

/**
 * Day and time the pet is picked up: arrival at the request's origin stop, not the route start.
 * Without the route (or when the stop is not found) only the route date is known.
 */
export function pickupMoment(
  request: Pick<TransportRequest, 'origin' | 'desiredDate'>,
  route?: { serviceDate: string; startTime?: string; stops?: RouteStop[] },
): { date: string; time?: string } {
  const stops = route?.stops ?? []
  const index = stops.findIndex((stop) => stop.locality === request.origin)
  if (!route || index < 0) return { date: request.desiredDate }
  return routeStopArrivals(route.serviceDate, route.startTime ?? DEFAULT_ROUTE_START_TIME, stops)[
    index
  ]
}

const compactDate = (value: string) => value.replaceAll('-', '')

function nextDay(value: string) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function eventTitle(request: CalendarRequest) {
  const names = request.animals
    .map((animal) => animal.name?.trim() || animal.species)
    .filter(Boolean)
    .join(', ')
  return `Transporte${names ? ` de ${names}` : ' de mascota'}: ${request.origin} → ${request.destination}`
}

function eventDetails(request: CalendarRequest) {
  return `Recogida en ${request.origin} y entrega en ${request.destination}. Te avisaremos con la hora aproximada de recogida.`
}

const escapeIcs = (value: string) =>
  value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\n', '\\n')

export function transportCalendarIcs(request: CalendarRequest, now = new Date()) {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kache Envios//Transportes//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${request.id}@kache-envios`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(request.desiredDate)}`,
    `DTEND;VALUE=DATE:${compactDate(nextDay(request.desiredDate))}`,
    `SUMMARY:${escapeIcs(eventTitle(request))}`,
    `DESCRIPTION:${escapeIcs(eventDetails(request))}`,
    `LOCATION:${escapeIcs(request.origin)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

export function googleCalendarUrl(request: CalendarRequest) {
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(request),
    dates: `${compactDate(request.desiredDate)}/${compactDate(nextDay(request.desiredDate))}`,
    details: eventDetails(request),
    location: request.origin,
  })}`
}
