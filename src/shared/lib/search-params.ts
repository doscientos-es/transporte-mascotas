export type SearchParamUpdates = Record<string, string | number | null | undefined>

export function readPageParam(value: string | null) {
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export function readEnumParam<Value extends string>(
  value: string | null,
  values: readonly Value[],
  fallback: Value,
) {
  return values.includes(value as Value) ? (value as Value) : fallback
}

export function updateSearchParams(current: URLSearchParams, updates: SearchParamUpdates) {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === '') next.delete(key)
    else next.set(key, String(value))
  }
  return next
}
