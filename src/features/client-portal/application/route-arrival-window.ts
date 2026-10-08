/** Coarse customer-facing arrival period; deliberately does not expose the scheduled time. */
export function approximateArrivalPeriod(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const minutesOfDay = hours * 60 + minutes

  if (minutesOfDay >= 6 * 60 && minutesOfDay < 12 * 60) return 'mañana (06:00–12:00)'
  if (minutesOfDay >= 12 * 60 && minutesOfDay < 15 * 60) return 'mediodía (12:00–15:00)'
  if (minutesOfDay >= 15 * 60 && minutesOfDay < 21 * 60) return 'tarde (15:00–21:00)'
  if (minutesOfDay >= 21 * 60) return 'noche (21:00–00:00)'
  return 'madrugada (00:00–06:00)'
}
