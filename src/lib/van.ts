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

export type VanLane = { id: string; side: 'left' | 'right'; boxes: number[]; size: AnimalSize }

// Physical order from the supplied FURGONETA part: the cab is at the top and
// the aisle separates the left and right banks. It intentionally is not a
// numerical sequence.
export const vanLanes: VanLane[] = [
  { id: 'left-outer-small', side: 'left', size: 'pequeno', boxes: [36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25] },
  { id: 'left-inner-small', side: 'left', size: 'pequeno', boxes: [24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13] },
  { id: 'left-medium', side: 'left', size: 'mediano', boxes: [12, 11, 10, 9, 8, 7, 6, 5] },
  { id: 'left-large', side: 'left', size: 'grande', boxes: [4, 3, 2, 1] },
  { id: 'right-large', side: 'right', size: 'grande', boxes: [37, 38, 39, 40] },
  { id: 'right-medium', side: 'right', size: 'mediano', boxes: [41, 42, 43, 44, 45, 46, 47, 48] },
  { id: 'right-inner-small', side: 'right', size: 'pequeno', boxes: [49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60] },
  { id: 'right-outer-small', side: 'right', size: 'pequeno', boxes: [61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72] },
]

export const boxGridSpan: Record<AnimalSize, number> = { pequeno: 2, mediano: 3, grande: 6 }
