/** Localities a client can be picked up at: every stop except the last, without repeats. */
export function pickupOptions(localities: string[]) {
  return [...new Set(localities.slice(0, -1))]
}

/**
 * Localities a client can be delivered to: those after the first occurrence of the pickup,
 * without repeats and never the pickup itself (a route may come back to the same town).
 */
export function deliveryOptions(localities: string[], origin: string) {
  const pickupIndex = localities.indexOf(origin)
  if (!origin || pickupIndex < 0) return []
  return [...new Set(localities.slice(pickupIndex + 1))].filter((locality) => locality !== origin)
}
