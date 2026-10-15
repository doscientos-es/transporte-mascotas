import type { Session } from '@supabase/supabase-js'

import { ClientPortalPage } from '@/features/client-portal'
import type { DashboardNavigation, NavSection, UserProfile } from '@/shared/types'

import { usePageMetadata } from './use-page-metadata'

type Props = { session: Session; profile: UserProfile; navigation: DashboardNavigation }

const metadata: Partial<Record<NavSection, readonly [string, string]>> = {
  'proximas-rutas': ['Próximas rutas', 'Consulta las próximas salidas disponibles.'],
  'mis-transportes': ['Mis transportes', 'Sigue el estado de tus transportes de mascotas.'],
  'solicitar-transporte': [
    'Solicitar transporte',
    'Elige una salida y solicita el transporte de tu mascota.',
  ],
} as const

export function ClientPortalRoutePage({ session, profile, navigation }: Props) {
  const { isCreatingRequest, section } = navigation
  const fallbackMetadata = [
    'Mis transportes',
    'Sigue el estado de tus transportes de mascotas.',
  ] as const
  const [title, description] = isCreatingRequest
    ? ['Solicitar transporte', 'Elige una salida y solicita el transporte de tu mascota.']
    : (metadata[section] ?? fallbackMetadata)
  usePageMetadata(title, description)

  return <ClientPortalPage session={session} profile={profile} navigation={navigation} />
}
