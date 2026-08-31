import { describe, expect, it } from 'vitest'

import type { Client, ClientInvoice, Letter } from '@/shared/types'

import { findClientForLetter } from './related-records'

const client = { id: 'client-1', fullName: 'María López' } as Client
const letter = { id: 'CARTA-1', billingClient: { fullName: 'María López' } } as Letter

describe('findClientForLetter', () => {
  it('uses the invoice relation before matching the billing name', () => {
    const invoice = { letterId: letter.id, clientId: client.id } as ClientInvoice

    expect(findClientForLetter(letter, [invoice], [client])).toBe(client)
  })

  it('matches a saved billing client without an invoice', () => {
    expect(findClientForLetter(letter, [], [client])).toBe(client)
  })

  it('does not link a letter when there is no related client', () => {
    expect(findClientForLetter(letter, [], [])).toBeUndefined()
  })
})
