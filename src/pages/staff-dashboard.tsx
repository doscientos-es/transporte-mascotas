import type { Session } from '@supabase/supabase-js'

import { AdminDashboardPage } from '@/features/dashboard'
import type { DashboardNavigation, NavSection, UserProfile } from '@/shared/types'

import { usePageMetadata } from './use-page-metadata'

type Props = { session: Session; profile: UserProfile; navigation: DashboardNavigation }
const labels: Record<NavSection, string> = {
  cartas: 'Cartas de porte',
  clientes: 'Clientes',
  plantillas: 'Plantillas',
  rutas: 'Rutas',
  furgoneta: 'Furgoneta',
  facturas: 'Facturas',
  solicitudes: 'Solicitudes',
  ajustes: 'Ajustes',
  'whatsapp-test': 'Pruebas de WhatsApp',
  'proximas-rutas': 'Próximas rutas',
  'mis-transportes': 'Mis transportes',
  'mis-mascotas': 'Mis mascotas',
}

export function StaffDashboardRoutePage({ session, profile, navigation }: Props) {
  const { section } = navigation
  usePageMetadata(
    labels[section],
    `Gestiona ${labels[section].toLocaleLowerCase()} en Kache Envíos.`,
  )

  return <AdminDashboardPage session={session} profile={profile} navigation={navigation} />
}
