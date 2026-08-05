import type { AnimalSize } from './types'

export const boxesBySize: Record<AnimalSize, number[]> = {
  grande: [1, 2, 3, 4, 37, 38, 39, 40],
  mediano: [5, 6, 7, 8, 9, 10, 11, 12, 41, 42, 43, 44, 45, 46, 47, 48],
  pequeno: Array.from({ length: 24 }, (_, index) => index + 13).concat(Array.from({ length: 24 }, (_, index) => index + 49)),
}

export function boxSize(box: number): AnimalSize {
  if (boxesBySize.grande.includes(box)) return 'grande'
  if (boxesBySize.mediano.includes(box)) return 'mediano'
  return 'pequeno'
}
