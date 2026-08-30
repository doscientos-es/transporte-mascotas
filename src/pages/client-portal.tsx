import type { Session } from '@supabase/supabase-js'

import { ClientPortalPage } from '@/features/client-portal'
import type { DashboardNavigation, NavSection, UserProfile } from '@/shared/types'

import { usePageMetadata } from './use-page-metadata'

type Props = { session: Session; profile: UserProfile; navigation: DashboardNavigation }

const metadata: Partial<Record<NavSection, readonly [string, string]>> = {
  'proximas-rutas': ['Próximas rutas', 'Consulta las próximas salidas disponibles.'],
  'mis-transportes': ['Mis transportes', 'Sigue el estado de tus transportes de mascotas.'],
  'mis-mascotas': [
    'Mis mascotas',
    'Consulta los datos de las mascotas incluidas en tus transportes.',
  ],
} as const

export function ClientPortalRoutePage({ session, profile, navigation }: Props) {
  const { section } = navigation
  const fallbackMetadata = [
    'Mis transportes',
    'Sigue el estado de tus transportes de mascotas.',
  ] as const
  const [title, description] = metadata[section] ?? fallbackMetadata
  usePageMetadata(title, description)

  return <ClientPortalPage session={session} profile={profile} navigation={navigation} />
}
