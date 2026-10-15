import type { TransportPaymentAttemptStatus } from '@/shared/types'

export function canRetryTransportPayment(status: TransportPaymentAttemptStatus) {
  // 'started' se marca al abrir la pasarela, aunque el cliente no llegue a pagar. El backend
  // reutiliza el mismo pedido (misma referencia), así que reintentar no duplica el cobro.
  return status === 'not_started' || status === 'started' || status === 'failed'
}

export function transportPaymentAttemptNotice(status: TransportPaymentAttemptStatus) {
  if (status === 'started')
    return 'Todavía no hemos recibido el pago. Si lo acabas de hacer, espera unos minutos; si no, puedes completarlo ahora.'
  if (status === 'confirmation_pending')
    return 'CaixaBank ha notificado el pago. Estamos terminando de confirmar la solicitud; no necesitas volver a pagar.'
  if (status === 'review_required')
    return 'No hemos podido conciliar automáticamente la respuesta del banco. No vuelvas a pagar; contacta con Kache Envíos para revisar la operación.'
  if (status === 'failed')
    return 'CaixaBank ha indicado que el pago no se completó. Puedes volver a intentarlo.'
  return null
}
