import type { AnimalSize } from './types'
import { supabase } from './supabase'

export type PricingRule = { category: AnimalSize; minWeightKg: number; maxWeightKg: number | null; amount: number; dimensionsText: string }

export const defaultPricingRules: PricingRule[] = [
  { category: 'pequeno', minWeightKg: 0, maxWeightKg: 2.5, amount: 100, dimensionsText: 'Box pequeño' },
  { category: 'mediano', minWeightKg: 0, maxWeightKg: 14, amount: 120, dimensionsText: 'Box mediano' },
  { category: 'grande', minWeightKg: 0, maxWeightKg: null, amount: 180, dimensionsText: 'Box grande' },
]

const rank: Record<AnimalSize, number> = { pequeno: 0, mediano: 1, grande: 2 }

export function recommendCategory(weightKg: number, size: AnimalSize, rules = defaultPricingRules): AnimalSize {
  const byWeight = rules.find((rule) => weightKg >= rule.minWeightKg && (rule.maxWeightKg === null || weightKg <= rule.maxWeightKg))?.category ?? 'grande'
  return rank[byWeight] > rank[size] ? byWeight : size
}

export function allowedCategories(recommended: AnimalSize): AnimalSize[] {
  return (Object.keys(rank) as AnimalSize[]).filter((category) => rank[category] >= rank[recommended])
}

export function priceFor(category: AnimalSize, rules = defaultPricingRules) {
  return rules.find((rule) => rule.category === category)?.amount ?? 0
}

export async function loadPricingRules(): Promise<PricingRule[]> {
  if (!supabase) return defaultPricingRules
  const { data, error } = await Promise.race([
    supabase.from('pricing_rules').select('category,min_weight_kg,max_weight_kg,amount,dimensions_text').eq('active', true).order('amount'),
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('La conexión con las tarifas está tardando demasiado. Inténtalo de nuevo.')), 10000)),
  ])
  if (error) throw error
  return (data ?? []).map((rule) => ({ category: rule.category, minWeightKg: Number(rule.min_weight_kg), maxWeightKg: rule.max_weight_kg === null ? null : Number(rule.max_weight_kg), amount: Number(rule.amount), dimensionsText: rule.dimensions_text })) as PricingRule[]
}
