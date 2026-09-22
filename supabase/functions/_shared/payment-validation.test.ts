import { describe, expect, it } from 'vitest'

import { isSuccessfulCyberpacPayment, isValidCyberpacNotification } from './payment-validation.ts'

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
    ['a rejected response', { response: '100' }],
    ['a negative response', { response: '-1' }],
    ['a fractional response', { response: '0.5' }],
    ['a different currency', { currency: '840' }],
  ])('rejects %s', (_, change) => {
    expect(isSuccessfulCyberpacPayment({ ...validPayment, ...change })).toBe(false)
  })
})
