import { describe, expect, it } from 'vitest'

import { canRetryTransportPayment, transportPaymentAttemptNotice } from './payment-attempt'

describe('transport payment attempt state', () => {
  it.each(['confirmation_pending', 'review_required', 'confirmed'] as const)(
    'does not allow retry while state is %s',
    (status) => {
      expect(canRetryTransportPayment(status)).toBe(false)
    },
  )

  it.each(['not_started', 'started', 'failed'] as const)('allows retry for %s', (status) => {
    expect(canRetryTransportPayment(status)).toBe(true)
  })

  it('tells customers payment is not received yet when the gateway was only opened', () => {
    expect(transportPaymentAttemptNotice('started')).toContain('Todavía no hemos recibido el pago')
  })

  it('warns customers not to pay twice while a bank result is uncertain', () => {
    expect(transportPaymentAttemptNotice('review_required')).toContain('No vuelvas a pagar')
  })
})
