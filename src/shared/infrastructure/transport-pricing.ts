import {
  defaultTransportBoxCatalog,
  transportBoxCategories,
  type TransportBoxCatalog,
} from '@/shared/application/transport-boxes'

import { requireSupabase } from './supabase'

export async function loadTransportBoxCatalog(): Promise<TransportBoxCatalog> {
  const { data, error } = await requireSupabase()
    .from('transport_box_catalog')
    .select('category, label, amount_cents, large_amount_cents, dimensions, sort_order')
  if (error) throw error
  const catalog = { ...defaultTransportBoxCatalog }
  for (const row of data ?? []) {
    if (transportBoxCategories.includes(row.category as (typeof transportBoxCategories)[number])) {
      const category = row.category as keyof TransportBoxCatalog
      catalog[category] = {
        category,
        label: row.label,
        amountCents: Number(row.amount_cents),
        largeAmountCents:
          row.large_amount_cents === null ? undefined : Number(row.large_amount_cents),
        dimensions: row.dimensions,
        sortOrder: Number(row.sort_order),
      }
    }
  }
  return catalog
}

export async function saveTransportBoxCatalog(catalog: TransportBoxCatalog) {
  const prices = Object.fromEntries(
    transportBoxCategories.flatMap((category) => {
      const item = catalog[category]
      return [
        [category, Math.round(item.amountCents)],
        ...(item.largeAmountCents === undefined
          ? []
          : [[`${category}_grande`, Math.round(item.largeAmountCents)]]),
      ]
    }),
  )
  const { error } = await requireSupabase().rpc('update_transport_box_catalog', {
    p_prices: prices,
  })
  if (error) throw error
}
