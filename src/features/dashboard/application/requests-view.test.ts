import { describe, expect, it } from 'vitest'

import { requestStatusesForView, requestsViewFromSearchParams } from './requests-view'

describe('request views', () => {
  it('loads only the transport statuses relevant to each tab', () => {
    expect(requestStatusesForView('pending')).toEqual(['por_verificar'])
    expect(requestStatusesForView('payments')).toEqual(['pago_pendiente'])
    expect(requestStatusesForView('history')).toEqual([
      'confirmada',
      'rechazada',
      'en_ruta',
      'entregada',
      'cancelada',
    ])
  })

  it('opens the payments tab for payment-request deep links', () => {
    for (const param of ['letter', 'invoice', 'factura', 'cobro']) {
      expect(requestsViewFromSearchParams(new URLSearchParams(`${param}=item-1`))).toBe('payments')
    }
    expect(requestsViewFromSearchParams(new URLSearchParams())).toBe('pending')
  })
})
