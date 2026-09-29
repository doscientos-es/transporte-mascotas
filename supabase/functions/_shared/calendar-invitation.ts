export type TransportEvent = {
  /** Stable identifier, so a resent invitation updates the same calendar event. */
  uid: string
  date: string
  title: string
  description: string
  location: string
}
type Invitation = { organizer: string; attendee: string; attendeeName: string }

const compactDate = (value: string) => value.replaceAll('-', '')

function nextDay(value: string) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

const escapeText = (value: string) =>
  value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r?\n/g, '\\n')

const escapeParam = (value: string) => `"${value.replace(/["\r\n]/g, '')}"`

/** RFC 5545 §3.1: content lines are folded at 75 octets. */
function fold(line: string) {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  for (const char of line) {
    const limit = parts.length ? 74 : 75
    if (encoder.encode(current + char).length > limit) {
      parts.push(current)
      current = char
    } else current += char
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/**
 * All-day invitation for the transport day. With an organizer it is sent as
 * METHOD:REQUEST so mail clients offer to add it (or add it automatically).
 */
export function transportInvitationIcs(
  event: TransportEvent,
  invitation: Invitation,
  now = new Date(),
) {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
  const request = Boolean(invitation.organizer)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kache Envios//Transportes//ES',
    'CALSCALE:GREGORIAN',
    `METHOD:${request ? 'REQUEST' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp}`,
    'SEQUENCE:0',
    'STATUS:CONFIRMED',
    'TRANSP:TRANSPARENT',
    `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
    `DTEND;VALUE=DATE:${compactDate(nextDay(event.date))}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(event.location)}`,
    ...(request
      ? [
          `ORGANIZER;CN="Kache Envíos":mailto:${invitation.organizer}`,
          `ATTENDEE;CN=${escapeParam(invitation.attendeeName || invitation.attendee)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${invitation.attendee}`,
        ]
      : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(event.title)}`,
    'TRIGGER:-PT6H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .map(fold)
    .join('\r\n')
}

export function googleCalendarUrl(event: TransportEvent) {
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${compactDate(event.date)}/${compactDate(nextDay(event.date))}`,
    details: event.description,
    location: event.location,
  })}`
}
