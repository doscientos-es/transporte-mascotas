import { letterToCarriageLetter } from '@/features/client-portal'
import type { DailyRoute, Letter } from '@/shared/types'

/** Select each transport once by its actual route actions, not by route name or date. */
export function routeCarriageLetters(route: DailyRoute, letters: Letter[]) {
  const lettersById = new Map(letters.map((letter) => [letter.id, letter]))
  const ids = [...new Set(route.actions.map((action) => action.letterId))]

  return ids.flatMap((id) => {
    const letter = lettersById.get(id)
    if (!letter)
      throw new Error('Faltan cartas de la ruta. Recarga la página e inténtalo de nuevo.')
    if (letter.status === 'cancelada') return []
    const box = route.actions.find(
      (action) => action.letterId === id && action.type === 'recogida',
    )?.box
    return [letterToCarriageLetter(letter, box ?? null)]
  })
}
