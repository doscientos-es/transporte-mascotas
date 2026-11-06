import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { TransportRequest } from '@/shared/types'

import { PaymentSuccessPanel } from './payment-success-panel'

describe('payment success notice', () => {
  const request = {
    id: 'request',
    status: 'confirmada',
    amountCents: 1000,
    desiredDate: '2026-12-10',
    origin: 'Madrid',
    destination: 'Valencia',
    animals: [],
  } as TransportRequest
  const props = {
    confirming: false,
    formatCurrency: () => '10 €',
    onDownloadInvoice: vi.fn(),
    onDownloadCarriageLetter: vi.fn(),
    onClose: vi.fn(),
  }

  it('shows the later email notice only after payment has been recorded', () => {
    const confirmed = renderToStaticMarkup(
      createElement(PaymentSuccessPanel, { ...props, request }),
    )
    expect(confirmed).toContain('recibirás un email con la hora exacta')
    const pending = renderToStaticMarkup(
      createElement(PaymentSuccessPanel, {
        ...props,
        request: { ...request, status: 'pago_pendiente' },
      }),
    )
    expect(pending).not.toContain('recibirás un email con la hora exacta')
  })
})
