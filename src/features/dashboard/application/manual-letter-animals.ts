import type { LetterDraft } from '@/shared/types'

export function validateManualLetterBreeds(animals: LetterDraft['animals']) {
  if (animals.some((animal) => !animal.breed.trim())) {
    throw new Error('Indica la raza de cada mascota.')
  }
}
