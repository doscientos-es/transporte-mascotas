import { defaultTransportBoxPrices, type AnimalSize, type TransportBoxPrices } from '@/shared/types'

import { requireSupabase } from './supabase'

const sizes: AnimalSize[] = ['pequeno', 'mediano', 'grande']

export async function loadTransportBoxPrices(): Promise<TransportBoxPrices> {
  const { data, error } = await requireSupabase()
    .from('transport_box_prices')
    .select('size, amount_cents')
  if (error) throw error
  const prices = { ...defaultTransportBoxPrices }
  for (const row of data ?? []) {
    if (sizes.includes(row.size as AnimalSize))
      prices[row.size as AnimalSize] = Number(row.amount_cents) / 100
  }
  return prices
}

export async function saveTransportBoxPrices(prices: TransportBoxPrices) {
  const cents = Object.fromEntries(sizes.map((size) => [size, Math.round(prices[size] * 100)]))
  const { error } = await requireSupabase().rpc('update_transport_box_prices', {
    p_prices: cents,
  })
  if (error) throw error
}
