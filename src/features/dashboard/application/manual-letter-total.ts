import {
  transportAnimalsTotalCents,
  type TransportBoxCatalog,
} from '@/shared/application/transport-boxes'
import type { LetterDraft } from '@/shared/types'

export function manualLetterTotalCents(
  draft: Pick<LetterDraft, 'animals' | 'billingTotal'>,
  catalog: TransportBoxCatalog,
): number {
  const value = draft.billingTotal?.trim()
  if (value !== undefined && !/^\d+(?:[.,]\d{1,2})?$/.test(value))
    throw new Error('Indica un importe positivo con un máximo de dos decimales.')

  const cents =
    value === undefined
      ? transportAnimalsTotalCents(draft.animals, catalog)
      : Math.round(Number(value.replace(',', '.')) * 100)
  if (!Number.isSafeInteger(cents) || cents <= 0)
    throw new Error('El importe a cobrar debe ser mayor que cero.')
  return cents
}
