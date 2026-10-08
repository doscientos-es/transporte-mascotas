import { describe, expect, it } from 'vitest'

import {
  cyberpacPaymentOutcome,
  cyberpacTransportGatewayResponse,
  isSuccessfulCyberpacPayment,
  isValidCyberpacNotification,
} from './payment-validation.ts'

describe('isValidCyberpacNotification', () => {
  const validNotification = {
    signatureVersion: 'HMAC_SHA256_V1',
    order: 'B12345678901',
    secret: 'configured-secret',
    merchantCode: '369901590',
    terminal: '1',
    currency: '978',
    notification: { Ds_MerchantCode: '369901590', Ds_Terminal: '1', Ds_Currency: '978' },
    signature: 'signature',
    expectedSignature: 'signature',
  }

  it('accepts a complete matching notification', () => {
    expect(isValidCyberpacNotification(validNotification)).toBe(true)
  })

  it('accepts the current SHA-512 signature version', () => {
    expect(
      isValidCyberpacNotification({
        ...validNotification,
        signatureVersion: 'HMAC_SHA512_V2',
      }),
    ).toBe(true)
  })

  it('accepts Redsys terminal numbers padded with leading zeroes', () => {
    expect(
      isValidCyberpacNotification({
        ...validNotification,
        notification: { ...validNotification.notification, Ds_Terminal: '001' },
      }),
    ).toBe(true)
  })

  it.each([
    ['the signature version', { signatureVersion: 'SHA1' }],
    [
      'the merchant code',
      { notification: { ...validNotification.notification, Ds_MerchantCode: 'other' } },
    ],
    ['the terminal', { notification: { ...validNotification.notification, Ds_Terminal: '2' } }],
    ['the currency', { notification: { ...validNotification.notification, Ds_Currency: '840' } }],
    ['the signature', { signature: 'tampered' }],
    ['the secret', { secret: undefined }],
  ])('rejects a notification with an invalid %s', (_, change) => {
    expect(isValidCyberpacNotification({ ...validNotification, ...change })).toBe(false)
  })
})

describe('isSuccessfulCyberpacPayment', () => {
  const validPayment = {
    amount: '8000',
    response: '00',
    expectedAmount: 8000,
    currency: '978',
    expectedCurrency: '978',
  }

  it('accepts response codes from 00 through 99 with the exact amount and currency', () => {
    expect(isSuccessfulCyberpacPayment(validPayment)).toBe(true)
    expect(isSuccessfulCyberpacPayment({ ...validPayment, response: '99' })).toBe(true)
  })

  it.each([
    ['a different amount', { amount: '8001' }],
    ['an empty amount', { amount: '' }],
    ['a rejected response', { response: '100' }],
    ['an empty response', { response: '' }],
    ['a negative response', { response: '-1' }],
    ['a fractional response', { response: '0.5' }],
    ['a different currency', { currency: '840' }],
  ])('rejects %s', (_, change) => {
    expect(isSuccessfulCyberpacPayment({ ...validPayment, ...change })).toBe(false)
  })
})

describe('cyberpacPaymentOutcome', () => {
  const approved = {
    amount: '12000',
    response: '00',
    expectedAmount: 12000,
    currency: '978',
    expectedCurrency: '978',
  }

  it('marks an exact approved payment as paid', () => {
    expect(cyberpacPaymentOutcome(approved)).toBe('paid')
  })

  it('requires review when an approved response has a missing or mismatched amount', () => {
    expect(cyberpacPaymentOutcome({ ...approved, amount: undefined })).toBe('review_required')
    expect(cyberpacPaymentOutcome({ ...approved, amount: '11999' })).toBe('review_required')
  })

  it('allows retry only when Cyberpac reports a clear decline response', () => {
    expect(cyberpacPaymentOutcome({ ...approved, response: '100' })).toBe('declined')
    expect(cyberpacPaymentOutcome({ ...approved, response: undefined })).toBe('review_required')
    expect(cyberpacPaymentOutcome({ ...approved, response: '' })).toBe('review_required')
  })
})

describe('cyberpacTransportGatewayResponse', () => {
  it('includes the received amount required to persist a verified transport payment', () => {
    expect(
      cyberpacTransportGatewayResponse({
        Ds_Response: '00',
        Ds_Amount: '12000',
        Ds_AuthorisationCode: '123456',
        Ds_Date: '1008',
        Ds_Hour: '1601',
      }),
    ).toEqual({
      response: '00',
      authorisationCode: '123456',
      amountCents: '12000',
      date: '1008',
      hour: '1601',
    })
  })
})
