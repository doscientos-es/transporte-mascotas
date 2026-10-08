import type { TransportPaymentAttemptStatus } from '@/shared/types'

export function canRetryTransportPayment(status: TransportPaymentAttemptStatus) {
  return status === 'not_started' || status === 'failed'
}

export function transportPaymentAttemptNotice(status: TransportPaymentAttemptStatus) {
  if (status === 'started')
    return 'El pago se ha iniciado y esperamos la confirmación de CaixaBank. No vuelvas a pagar mientras comprobamos el resultado.'
  if (status === 'confirmation_pending')
    return 'CaixaBank ha notificado el pago. Estamos terminando de confirmar la solicitud; no necesitas volver a pagar.'
  if (status === 'review_required')
    return 'No hemos podido conciliar automáticamente la respuesta del banco. No vuelvas a pagar; contacta con Kache Envíos para revisar la operación.'
  if (status === 'failed')
    return 'CaixaBank ha indicado que el pago no se completó. Puedes volver a intentarlo.'
  return null
}
