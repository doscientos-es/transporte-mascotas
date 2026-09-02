/** The itinerary can only be closed on the calendar day immediately before service in Madrid. */
export function canCloseRouteOn(serviceDate: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const madridToday = `${date.year}-${date.month}-${date.day}`
  const tomorrow = new Date(`${madridToday}T00:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return serviceDate === tomorrow.toISOString().slice(0, 10)
}