import type { AnimalSize } from '@/shared/types'

export type AnimalMeasurements = {
  weightKg: number
  lengthCm: number
  heightCm: number
}

export function sizeForMeasurements({
  weightKg,
  lengthCm,
  heightCm,
}: AnimalMeasurements): AnimalSize {
  if (weightKg >= 25 || lengthCm >= 80 || heightCm >= 60) return 'grande'
  if (weightKg >= 10 || lengthCm >= 55 || heightCm >= 40) return 'mediano'
  return 'pequeno'
}

export function animalSizeLabel(size: AnimalSize) {
  return { pequeno: 'Pequeño', mediano: 'Mediano', grande: 'Grande' }[size]
}
