import type { NavSection } from '@/shared/types'

/** Sections available to customers, shared by the shell and access policies. */
export const clientSections = new Set<NavSection>([
  'proximas-rutas',
  'mis-transportes',
  'mis-mascotas',
])
