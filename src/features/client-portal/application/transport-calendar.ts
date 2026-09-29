import type { TransportRequest } from '@/shared/types'

type CalendarRequest = Pick<
  TransportRequest,
  'id' | 'origin' | 'destination' | 'desiredDate' | 'animals'
>

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
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
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
