import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { NavSection } from '@/shared/types'

import { DashboardLayout } from './dashboard-layout'

describe('DashboardLayout', () => {
  it('uses the shared mobile navigation for the visible destinations', () => {
    const markup = renderToStaticMarkup(
      createElement(
        DashboardLayout,
        {
          section: 'rutas',
          pendingLetters: 0,
          profileRole: 'transportista',
          displayName: 'Ana Transportes',
          onNavigate: vi.fn(),
          hrefForSection: (section: NavSection) => `/${section}`,
          onSignOut: vi.fn(),
        } as unknown as ComponentProps<typeof DashboardLayout>,
        'Contenido',
      ),
    )

    expect(markup).toContain('data-slot="mobile-navigation"')
    expect(markup).toContain('aria-label="Navegación móvil"')
    expect(markup.match(/data-slot="mobile-navigation-item"/g)).toHaveLength(2)
    expect(markup).toContain('data-active="true"')
    expect(markup).toContain('flex-1')
    expect(markup).toContain('kache-dashboard-sidebar')
    expect(markup).toContain('kache-dashboard-mobile-navigation')
  })
})
