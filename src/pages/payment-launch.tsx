import { PaymentLaunchPage } from '@/features/client-portal'

import { usePageMetadata } from './use-page-metadata'

export function PaymentLaunchRoutePage() {
  usePageMetadata('Pago seguro', 'Conectando con la pasarela para completar el pago.')
  return <PaymentLaunchPage />
}
