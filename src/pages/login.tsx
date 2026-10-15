import { LoginPage } from '@/features/auth'

import { usePageMetadata } from './use-page-metadata'

export function LoginRoutePage() {
  usePageMetadata(
    'Transporte de mascotas',
    'Gestiona el transporte de tu mascota con Kache Envíos.',
  )
  return <LoginPage />
}
