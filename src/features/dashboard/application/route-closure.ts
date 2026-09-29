function madridToday(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${date.year}-${date.month}-${date.day}`
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** The itinerary can only be closed on the calendar day immediately before service in Madrid. */
export function canCloseRouteOn(serviceDate: string, now = new Date()) {
  return serviceDate === shiftDate(madridToday(now), 1)
}

export function routeCloseUnavailableReason(serviceDate: string, now = new Date()) {
  if (serviceDate <= madridToday(now))
    return 'La fecha de esta ruta ya ha llegado; solo se podía cerrar el día anterior.'
  const closeDay = new Date(`${shiftDate(serviceDate, -1)}T12:00:00Z`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  return `Podrás cerrar el itinerario el ${closeDay}, el día anterior a la ruta.`
}
