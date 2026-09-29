import {
  defaultTransportBoxCatalog,
  transportBoxCategories,
  type TransportBoxCatalog,
} from '@/shared/application/transport-boxes'

import { requireSupabase } from './supabase'

export async function loadTransportBoxCatalog(): Promise<TransportBoxCatalog> {
  const { data, error } = await requireSupabase()
    .from('transport_box_catalog')
    .select(
      'category, label, amount_cents, large_amount_cents, dimensions, max_length_cm, max_height_cm, max_width_cm, sort_order',
    )
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
        maxLengthCm: row.max_length_cm === null ? undefined : Number(row.max_length_cm),
        maxHeightCm: row.max_height_cm === null ? undefined : Number(row.max_height_cm),
        maxWidthCm: row.max_width_cm === null ? undefined : Number(row.max_width_cm),
        sortOrder: Number(row.sort_order),
      }
    }
  }
  return catalog
}

export async function saveTransportBoxCatalog(catalog: TransportBoxCatalog) {
  const items = Object.fromEntries(
    transportBoxCategories.map((category) => {
      const item = catalog[category]
      return [
        category,
        {
          amount_cents: Math.round(item.amountCents),
          large_amount_cents:
            item.largeAmountCents === undefined ? undefined : Math.round(item.largeAmountCents),
          dimensions: item.dimensions,
          max_length_cm: item.maxLengthCm,
          max_height_cm: item.maxHeightCm,
          max_width_cm: item.maxWidthCm,
        },
      ]
    }),
  )
  const { error } = await requireSupabase().rpc('update_transport_box_catalog', {
    p_items: items,
  })
  if (error) throw error
}
