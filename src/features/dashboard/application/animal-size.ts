import type { Animal, AnimalSize } from '@/shared/types'

type Measurements = Pick<Animal, 'weightKg' | 'lengthCm' | 'heightCm'>

export function sizeForMeasurements({ weightKg, lengthCm, heightCm }: Measurements): AnimalSize {
  if (weightKg >= 25 || lengthCm >= 80 || heightCm >= 60) return 'grande'
  if (weightKg >= 10 || lengthCm >= 55 || heightCm >= 40) return 'mediano'
  return 'pequeno'
}

export function animalSizeLabel(size: AnimalSize) {
  return { pequeno: 'Pequeño', mediano: 'Mediano', grande: 'Grande' }[size]
}
