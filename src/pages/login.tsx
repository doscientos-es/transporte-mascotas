import { LoginPage } from '@/features/auth'

import { usePageMetadata } from './use-page-metadata'

export function LoginRoutePage({ audience }: { audience: 'client' | 'staff' }) {
  const isStaff = audience === 'staff'
  usePageMetadata(
    isStaff ? 'Acceso profesional' : 'Transporte de mascotas',
    isStaff
      ? 'Acceso seguro para profesionales de Kache Envíos.'
      : 'Gestiona el transporte de tu mascota con Kache Envíos.',
  )
  return <LoginPage audience={isStaff ? 'staff' : 'client'} />
}
