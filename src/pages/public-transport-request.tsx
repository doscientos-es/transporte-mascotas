import { PublicTransportRequestPage } from '@/features/client-portal'

import { usePageMetadata } from './use-page-metadata'

export function PublicTransportRequestRoutePage() {
  usePageMetadata(
    'Solicitar transporte',
    'Solicita el transporte de tu mascota con Kache Envíos sin necesidad de crear una cuenta.',
  )
  return <PublicTransportRequestPage />
}
