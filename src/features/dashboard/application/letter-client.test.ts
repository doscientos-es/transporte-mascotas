import { describe, expect, it } from 'vitest'

import type { Client, LetterDraft } from '@/shared/types'

import { invoiceClientFromSaved } from './client-values'
import { withLetterClient } from './letter-client'

const client: Client = {
  id: 'client-1',
  fullName: 'Ana Pérez',
  nif: '12345678Z',
  email: 'ana@example.test',
  phone: '600000000',
  address: 'Calle Mayor 1',
  postalCode: '28001',
  city: 'Madrid',
  createdAt: '2026-01-01',
}

const emptyDraft: LetterDraft = {
  reference: '',
  routeId: '',
  sender: '',
  senderPhone: '',
  senderEmail: '',
  senderNif: '',
  senderAddress: '',
  senderPostalCode: '',
  senderCity: '',
  senderProvince: '',
  recipient: '',
  recipientPhone: '',
  recipientEmail: '',
  recipientNif: '',
  recipientAddress: '',
  recipientPostalCode: '',
  recipientCity: '',
  recipientProvince: '',
  origin: '',
  destination: '',
  originPoint: '',
  destinationPoint: '',
  accompanyingDocuments: [],
  atesNumber: '',
  billingPayer: 'remitente',
  otherPayer: {
    fullName: '',
    nif: '',
    email: '',
    phone: '',
    address: '',
    postalCode: '',
    city: '',
  },
  signatureConfirmed: false,
  animals: [],
}

describe('saved clients in a carriage letter', () => {
  it.each(['sender', 'recipient'] as const)(
    'prefills %s without modifying the other party or unrelated fields',
    (person) => {
      const other = person === 'sender' ? 'recipient' : 'sender'
      const draft: LetterDraft = {
        ...emptyDraft,
        [person]: 'Anterior',
        [`${person}Province`]: 'Provincia anterior',
        [other]: 'Otra persona',
        [`${other}Province`]: 'Otra provincia',
        reference: 'ref-1',
        origin: 'Origen',
      }
      const result = withLetterClient(draft, person, client)

      expect(result).toMatchObject({
        [person]: client.fullName,
        [`${person}Nif`]: client.nif,
        [`${person}Email`]: client.email,
        [`${person}Phone`]: client.phone,
        [`${person}Address`]: client.address,
        [`${person}PostalCode`]: client.postalCode,
        [`${person}City`]: client.city,
        [`${person}Province`]: '',
        [other]: 'Otra persona',
        [`${other}Province`]: 'Otra provincia',
        reference: 'ref-1',
        origin: 'Origen',
      })
      expect(draft[person]).toBe('Anterior')
    },
  )

  it('replaces missing fields instead of mixing data from different clients', () => {
    const draft = { ...emptyDraft, senderEmail: 'old@example.test', senderPhone: 'old' }
    const result = withLetterClient(draft, 'sender', { ...client, email: '', phone: '' })
    expect(result.senderEmail).toBe('')
    expect(result.senderPhone).toBe('')
  })

  it('copies only editable fiscal data for an alternative payer', () => {
    expect(invoiceClientFromSaved(client)).toEqual({
      fullName: client.fullName,
      nif: client.nif,
      email: client.email,
      phone: client.phone,
      address: client.address,
      postalCode: client.postalCode,
      city: client.city,
    })
  })
})
