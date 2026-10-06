const DAY_MS = 86_400_000
const MAX_ROUTE_DAYS = 14

function utcNoon(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`)
}

/** Every calendar day (`YYYY-MM-DD`) from `start` to `end`, both included. */
export function routeDays(start: string, end?: string | null) {
  const first = utcNoon(start)
  const last = end && end > start ? utcNoon(end) : first
  const count = Math.min(
    MAX_ROUTE_DAYS,
    Math.round((last.getTime() - first.getTime()) / DAY_MS) + 1,
  )
  return Array.from({ length: count }, (_, index) =>
    new Date(first.getTime() + index * DAY_MS).toISOString().slice(0, 10),
  )
}

/** Day numbers grouped by month: "1, 2 y 3 de octubre" or "30 y 31 de octubre y 1 de noviembre". */
export function routeDaysLabel(start: string, end?: string | null) {
  const month = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' })
  const groups: { month: string; days: number[] }[] = []
  for (const day of routeDays(start, end)) {
    const date = utcNoon(day)
    const name = month.format(date)
    const group = groups.at(-1)
    if (group?.month === name) group.days.push(date.getUTCDate())
    else groups.push({ month: name, days: [date.getUTCDate()] })
  }
  return groups
    .map(({ month: name, days }) => {
      const list =
        days.length > 1 ? `${days.slice(0, -1).join(', ')} y ${days.at(-1)}` : String(days[0])
      return `${list} de ${name}`
    })
    .join(' y ')
}

/** Calendar day and `HH:MM` reached `offsetMinutes` after departing at `startTime` on `date`. */
export function arrivalMoment(date: string, startTime: string, offsetMinutes: number) {
  const [hours, minutes] = startTime.split(':').map(Number)
  const moment = new Date(
    utcNoon(date).getTime() - 12 * 3_600_000 + (hours * 60 + minutes + offsetMinutes) * 60_000,
  )
  return {
    date: moment.toISOString().slice(0, 10),
    time: moment.toISOString().slice(11, 16),
  }
}
