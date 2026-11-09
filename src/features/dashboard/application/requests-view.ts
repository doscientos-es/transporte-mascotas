import type { TransportRequestStatus } from '@/shared/types'

export type RequestsView = 'pending' | 'payments' | 'history'

const statusesByView: Record<RequestsView, TransportRequestStatus[]> = {
  pending: ['por_verificar'],
  payments: ['pago_pendiente'],
  history: ['confirmada', 'rechazada', 'en_ruta', 'entregada', 'cancelada'],
}

const paymentRequestParams = ['letter', 'invoice', 'factura', 'cobro']

export function requestStatusesForView(view: RequestsView) {
  return statusesByView[view]
}

export function requestsViewFromSearchParams(searchParams: URLSearchParams): RequestsView {
  return paymentRequestParams.some((param) => searchParams.has(param)) ? 'payments' : 'pending'
}
