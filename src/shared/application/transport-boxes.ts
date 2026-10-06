import type { TransportRequestAnimal } from '@/shared/types'

export type TransportBoxCategory = 'pequeno' | 'mediano' | 'grande' | 'paso_rueda'

export type TransportBoxCatalogItem = {
  category: TransportBoxCategory
  label: string
  amountCents: number
  largeAmountCents?: number
  dimensions: string
  /** Largest pet measurements (cm) that fit; unset for the wheel-arch box. */
  maxLengthCm?: number
  maxHeightCm?: number
  maxWidthCm?: number
  /**
   * Heaviest pet (kg, inclusive) the box admits; above it the pet moves to the next box.
   * For the large box it is where the large tariff starts (heavier pets pay `largeAmountCents`).
   */
  nextBoxFromKg?: number
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
    maxLengthCm: 33,
    maxHeightCm: 29,
    maxWidthCm: 46,
    nextBoxFromKg: 2.5,
    sortOrder: 1,
  },
  mediano: {
    category: 'mediano',
    label: 'Box mediano',
    amountCents: 12000,
    dimensions: '50 × 52 × 50 cm',
    maxLengthCm: 50,
    maxHeightCm: 50,
    maxWidthCm: 52,
    nextBoxFromKg: 13,
    sortOrder: 2,
  },
  grande: {
    category: 'grande',
    label: 'Box grande',
    amountCents: 15000,
    largeAmountCents: 18000,
    dimensions: '100 × 58 × 75 cm · 180 € a partir de 40 kg',
    maxLengthCm: 100,
    maxHeightCm: 75,
    maxWidthCm: 58,
    nextBoxFromKg: 40,
    sortOrder: 3,
  },
  paso_rueda: {
    category: 'paso_rueda',
    label: 'Box paso de rueda',
    amountCents: 15000,
    dimensions: '100 × 36/58 × 36 × 75 cm · según tamaño',
    nextBoxFromKg: 40,
    sortOrder: 4,
  },
}

const number = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })

/** Text shown to clients, built from the box limits and tariffs so it never drifts from them. */
export function transportBoxDimensions(
  catalog: TransportBoxCatalog,
  category: TransportBoxCategory,
) {
  const item = catalog[category]
  const { maxLengthCm, maxWidthCm, maxHeightCm } = item
  const measures =
    maxLengthCm && maxWidthCm && maxHeightCm
      ? `${number.format(maxLengthCm)} × ${number.format(maxWidthCm)} × ${number.format(maxHeightCm)} cm`
      : 'según tamaño'
  const hasLargeTariff = item.largeAmountCents !== undefined
  return [
    measures,
    !hasLargeTariff && item.nextBoxFromKg && `hasta ${number.format(item.nextBoxFromKg)} kg`,
    item.largeAmountCents &&
      `${number.format(item.largeAmountCents / 100)} €${item.nextBoxFromKg ? ` a partir de ${number.format(item.nextBoxFromKg)} kg` : ''}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function transportBoxCategoryLabel(category: TransportBoxCategory) {
  return defaultTransportBoxCatalog[category].label
}

export function transportBoxCategoryRank(category: TransportBoxCategory) {
  return category === 'pequeno' ? 1 : category === 'mediano' ? 2 : 3
}

export function minimumTransportBoxCategory(
  {
    weightKg,
    lengthCm,
    heightCm,
    widthCm,
  }: Pick<TransportRequestAnimal, 'weightKg' | 'lengthCm' | 'heightCm' | 'widthCm'>,
  catalog: TransportBoxCatalog = defaultTransportBoxCatalog,
): Exclude<TransportBoxCategory, 'paso_rueda'> {
  const fits = (category: 'pequeno' | 'mediano') => {
    const item = catalog[category]
    return (
      lengthCm <= (item.maxLengthCm ?? Infinity) &&
      heightCm <= (item.maxHeightCm ?? Infinity) &&
      widthCm <= (item.maxWidthCm ?? Infinity) &&
      weightKg <= (item.nextBoxFromKg ?? Infinity)
    )
  }
  if (!fits('mediano')) return 'grande'
  if (fits('pequeno')) return 'pequeno'
  return 'mediano'
}

export function transportBoxPriceCents(
  category: TransportBoxCategory,
  animal: Pick<TransportRequestAnimal, 'weightKg'>,
  catalog: TransportBoxCatalog,
) {
  const item = catalog[category]
  // The large box charges its large tariff above the weight set in Ajustes.
  if (
    category === 'grande' &&
    item.largeAmountCents !== undefined &&
    animal.weightKg > (item.nextBoxFromKg ?? Infinity)
  )
    return item.largeAmountCents
  return item.amountCents
}

export function transportBoxOptions(
  minimum: Exclude<TransportBoxCategory, 'paso_rueda'>,
  weightKg = 0,
  catalog: TransportBoxCatalog = defaultTransportBoxCatalog,
) {
  const minimumRank = transportBoxCategoryRank(minimum)
  return transportBoxCategories.filter((category) =>
    category === 'paso_rueda'
      ? weightKg <= (catalog.paso_rueda.nextBoxFromKg ?? Infinity)
      : transportBoxCategoryRank(category) >= minimumRank,
  )
}

type PricedAnimal = Pick<
  TransportRequestAnimal,
  'weightKg' | 'lengthCm' | 'heightCm' | 'widthCm' | 'requestedBoxCategory'
>

/** The requested box, falling back to the minimum when it no longer fits the measurements. */
export function requestedTransportBoxCategory(
  animal: PricedAnimal,
  minimumCategory = minimumTransportBoxCategory(animal),
  catalog: TransportBoxCatalog = defaultTransportBoxCatalog,
): TransportBoxCategory {
  const requestedCategory = animal.requestedBoxCategory
  if (
    requestedCategory &&
    transportBoxOptions(minimumCategory, animal.weightKg, catalog).includes(requestedCategory)
  ) {
    return requestedCategory
  }
  return minimumCategory
}

export function transportAnimalPriceCents(animal: PricedAnimal, catalog: TransportBoxCatalog) {
  const minimumCategory = minimumTransportBoxCategory(animal, catalog)
  return transportBoxPriceCents(
    requestedTransportBoxCategory(animal, minimumCategory, catalog),
    { weightKg: animal.weightKg },
    catalog,
  )
}

export function transportAnimalsTotalCents(animals: PricedAnimal[], catalog: TransportBoxCatalog) {
  return animals.reduce((total, animal) => total + transportAnimalPriceCents(animal, catalog), 0)
}
