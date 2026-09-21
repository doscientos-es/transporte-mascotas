import { describe, expect, it } from 'vitest'

import {
  cyberpacSignature,
  decodeMerchantParameters,
  encodeMerchantParameters,
  safeEqual,
} from './cyberpac.ts'

const secret = 'AAECAwQFBgcICQoLDA0ODw=='

describe('Cyberpac helpers', () => {
  it('round-trips merchant parameters including non-ASCII text', () => {
    const parameters = { Ds_Order: 'B12345678901', Ds_ProductDescription: 'Transporte de Nala' }
    expect(decodeMerchantParameters(encodeMerchantParameters(parameters))).toEqual(parameters)
  })

  it('generates a deterministic signature for the same order and parameters', async () => {
    const parameters = encodeMerchantParameters({ Ds_Order: 'B12345678901', Ds_Amount: '8000' })
    const first = await cyberpacSignature('B12345678901', parameters, secret)
    const second = await cyberpacSignature('B12345678901', parameters, secret)
    expect(first).toBe(second)
    expect(first).not.toBe('')
  })

  it('changes the signature when signed data changes', async () => {
    const parameters = encodeMerchantParameters({ Ds_Order: 'B12345678901', Ds_Amount: '8000' })
    const changedParameters = encodeMerchantParameters({
      Ds_Order: 'B12345678901',
      Ds_Amount: '8001',
    })
    const original = await cyberpacSignature('B12345678901', parameters, secret)
    const changed = await cyberpacSignature('B12345678901', changedParameters, secret)
    expect(changed).not.toBe(original)
  })

  it('matches the AES-CBC and HMAC-SHA512 calculation', async () => {
    const parameters = encodeMerchantParameters({
      DS_MERCHANT_ORDER: '1234567890',
      DS_MERCHANT_AMOUNT: '12000',
    })
    await expect(
      cyberpacSignature('1234567890', parameters, 'merchant-test-key', 'HMAC_SHA512_V2'),
    ).resolves.toBe(
      'QoA7MMtYSfwxGvYcZsEJ_i46DvMVgfGVkgpc4IeYQqmHtFCjaro_xhWLz2IBsL57oQpes1FtYIME1UDrDndyhw',
    )
  })

  it('rejects malformed signing keys', async () => {
    const parameters = encodeMerchantParameters({ Ds_Order: 'B12345678901' })
    await expect(cyberpacSignature('B12345678901', parameters, 'invalid')).rejects.toThrow(
      '16 o 24 bytes',
    )
  })

  it('compares signatures without accepting different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })
})
