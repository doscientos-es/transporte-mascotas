/** Combines legacy site names and meeting directions into one driver-facing note. */
export function mergedStopInstructions(...values: Array<string | null | undefined>) {
  const parts = values.map((value) => value?.trim() ?? '').filter(Boolean)
  return [...new Set(parts)].join(' · ')
}
