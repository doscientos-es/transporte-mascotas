/** Coarse customer-facing arrival period; deliberately does not expose the scheduled time. */
export function approximateArrivalPeriod(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const minutesOfDay = hours * 60 + minutes

  if (minutesOfDay >= 6 * 60 && minutesOfDay < 12 * 60) return 'por la mañana'
  if (minutesOfDay >= 12 * 60 && minutesOfDay < 15 * 60) return 'al mediodía'
  if (minutesOfDay >= 15 * 60 && minutesOfDay < 20 * 60) return 'por la tarde'
  return 'por la noche'
}
