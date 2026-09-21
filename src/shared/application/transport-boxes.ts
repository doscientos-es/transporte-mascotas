import type { TransportRequestAnimal } from '@/shared/types'

export type TransportBoxCategory = 'pequeno' | 'mediano' | 'grande' | 'paso_rueda'

export type TransportBoxCatalogItem = {
  category: TransportBoxCategory
  label: string
  amountCents: number
  largeAmountCents?: number
  dimensions: string
  sortOrder: number
}

export type TransportBoxCatalog = Record<TransportBoxCategory, TransportBoxCatalogItem>

export const transportBoxCategories: TransportBoxCategory[] = [
  'pequeno',
  'mediano',
  'grande',
  'paso_rueda',
]

export const defaultTransportBoxCatalog: TransportBoxCatalog = {
  pequeno: {
    category: 'pequeno',
    label: 'Box pequeño',
    amountCents: 10000,
    dimensions: '33 × 46 × 29 cm · también 33 × 36 × 29 cm',
    sortOrder: 1,
  },
  mediano: {
    category: 'mediano',
    label: 'Box mediano',
    amountCents: 12000,
    dimensions: '50 × 52 × 50 cm',
    sortOrder: 2,
  },
  grande: {
    category: 'grande',
    label: 'Box grande',
    amountCents: 15000,
    largeAmountCents: 18000,
    dimensions: '100 × 58 × 75 cm · 180 € desde 50 kg',
    sortOrder: 3,
  },
  paso_rueda: {
    category: 'paso_rueda',
    label: 'Box paso de rueda',
    amountCents: 12000,
    largeAmountCents: 15000,
    dimensions: '100 × 36/58 × 36 × 75 cm · según tamaño',
    sortOrder: 4,
  },
}

export function transportBoxCategoryLabel(category: TransportBoxCategory) {
  return defaultTransportBoxCatalog[category].label
}

export function transportBoxCategoryRank(category: TransportBoxCategory) {
  return category === 'pequeno' ? 1 : category === 'mediano' ? 2 : 3
}

export function minimumTransportBoxCategory({
  weightKg,
  lengthCm,
  heightCm,
  widthCm,
}: Pick<TransportRequestAnimal, 'weightKg' | 'lengthCm' | 'heightCm' | 'widthCm'>): Exclude<
  TransportBoxCategory,
  'paso_rueda'
> {
  if (weightKg >= 50 || lengthCm > 50 || heightCm > 50 || widthCm > 52) return 'grande'
  if (lengthCm <= 33 && heightCm <= 29 && widthCm <= 46) return 'pequeno'
  if (lengthCm <= 50 && heightCm <= 50 && widthCm <= 52) return 'mediano'
  return 'grande'
}

export function transportBoxPriceCents(
  category: TransportBoxCategory,
  animal: Pick<TransportRequestAnimal, 'weightKg'> & {
    minimumCategory: Exclude<TransportBoxCategory, 'paso_rueda'>
  },
  catalog: TransportBoxCatalog,
) {
  const item = catalog[category]
  if (
    (category === 'grande' && animal.weightKg >= 50) ||
    (category === 'paso_rueda' && animal.minimumCategory === 'grande')
  )
    return item.largeAmountCents ?? item.amountCents
  return item.amountCents
}

export function transportBoxOptions(minimum: Exclude<TransportBoxCategory, 'paso_rueda'>) {
  const minimumRank = transportBoxCategoryRank(minimum)
  return transportBoxCategories.filter(
    (category) => category === 'paso_rueda' || transportBoxCategoryRank(category) >= minimumRank,
  )
}
