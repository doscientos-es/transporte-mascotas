import type { Client, LetterDraft } from '@/shared/types'

import { invoiceClientFromSaved } from './client-values'

export function withLetterClient(
  draft: LetterDraft,
  person: 'sender' | 'recipient',
  client: Client,
): LetterDraft {
  const values = invoiceClientFromSaved(client)
  return {
    ...draft,
    [person]: values.fullName,
    [`${person}Nif`]: values.nif,
    [`${person}Email`]: values.email,
    [`${person}Phone`]: values.phone,
    [`${person}Address`]: values.address,
    [`${person}PostalCode`]: values.postalCode,
    [`${person}City`]: values.city,
    // Clients do not store a province; do not carry it over from another person.
    [`${person}Province`]: '',
  }
}
