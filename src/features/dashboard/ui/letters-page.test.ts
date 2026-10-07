import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Letter } from '@/shared/types'

import { LettersPage } from './letters-page'

describe('LettersPage route selector', () => {
  it('shows route choices without a section heading or a wrapping card', () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(LettersPage, {
          letters: [
            {
              id: 'letter-1',
              route: 'Ruta Norte',
              routeTemplateColor: '#2a4227',
              serviceDate: '2026-10-07',
            } as Letter,
          ],
          loading: false,
          error: '',
          onRetry: vi.fn(),
          onEdit: vi.fn(),
          onOpenClient: vi.fn(),
          onOpenPaymentRequests: vi.fn(),
        }),
      ),
    )

    expect(markup).toContain('Ruta Norte')
    expect(markup).toContain('background-color:#2a4227')
    expect(markup).not.toContain('Cartas de porte por ruta')
    expect(markup).not.toContain('table-card')
  })

  it('filters routes by search text, template, and month', () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        {
          initialEntries: ['/?ruta-busqueda=norte&ruta-plantilla=Ruta%20Norte&ruta-mes=2026-10'],
        },
        createElement(LettersPage, {
          letters: [
            { id: 'north', route: 'Ruta Norte', serviceDate: '2026-10-07' } as Letter,
            { id: 'south', route: 'Ruta Sur', serviceDate: '2026-11-07' } as Letter,
          ],
          loading: false,
          error: '',
          onRetry: vi.fn(),
          onEdit: vi.fn(),
          onOpenClient: vi.fn(),
          onOpenPaymentRequests: vi.fn(),
        }),
      ),
    )

    expect(markup).toContain('aria-label="Filtrar rutas por plantilla"')
    expect(markup).toContain('aria-label="Filtrar rutas por mes"')
    expect(markup).toContain('aria-label="Ver 1 cartas de Ruta Norte')
    expect(markup).not.toContain('aria-label="Ver 1 cartas de Ruta Sur')
  })

  it('paginates route groups when there are more than twelve', () => {
    const letters = Array.from(
      { length: 13 },
      (_, index) =>
        ({
          id: `letter-${index + 1}`,
          route: `Ruta ${index + 1}`,
          serviceDate: '2026-10-07',
        }) as Letter,
    )
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(LettersPage, {
          letters,
          loading: false,
          error: '',
          onRetry: vi.fn(),
          onEdit: vi.fn(),
          onOpenClient: vi.fn(),
          onOpenPaymentRequests: vi.fn(),
        }),
      ),
    )

    expect(markup).toContain('aria-label="Paginación de rutas con cartas"')
    expect(markup).toContain('Mostrando 1–12 de 13 rutas')
  })

  it('places the all-routes button to the left of the selected route description', () => {
    const routeKey = encodeURIComponent(JSON.stringify(['Ruta Norte', '2026-10-07']))
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: [`/?ruta-carta=${routeKey}`] },
        createElement(LettersPage, {
          letters: [
            {
              id: 'north',
              route: 'Ruta Norte',
              serviceDate: '2026-10-07',
              status: 'pendiente',
              animals: [],
              billingClient: { fullName: 'Cliente' } as Letter['billingClient'],
            } as unknown as Letter,
          ],
          loading: false,
          error: '',
          onRetry: vi.fn(),
          onEdit: vi.fn(),
          onOpenClient: vi.fn(),
          onOpenPaymentRequests: vi.fn(),
        }),
      ),
    )
    const headerStart = markup.indexOf('<header')
    const headerEnd = markup.indexOf('</header>', headerStart)
    const header = markup.slice(headerStart, headerEnd)

    expect(header.indexOf('Todas las rutas')).toBeLessThan(
      header.indexOf('Cartas de porte de Ruta Norte.'),
    )
  })

  it('offers the payment and route lifecycle states in the letter filter', () => {
    const routeKey = encodeURIComponent(JSON.stringify(['Ruta Norte', '2026-10-07']))
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: [`/?ruta-carta=${routeKey}`] },
        createElement(LettersPage, {
          letters: [
            {
              id: 'letter-completed',
              route: 'Ruta Norte',
              serviceDate: '2026-10-07',
              status: 'entregada',
              animals: [],
              billingClient: { fullName: 'Cliente' } as Letter['billingClient'],
            } as unknown as Letter,
          ],
          loading: false,
          error: '',
          onRetry: vi.fn(),
          onEdit: vi.fn(),
          onOpenClient: vi.fn(),
          onOpenPaymentRequests: vi.fn(),
        }),
      ),
    )

    expect(markup).toContain('<option value="pendiente">Pendientes</option>')
    expect(markup).toContain('<option value="programada">Programadas</option>')
    expect(markup).toContain('<option value="en_ruta">En ruta</option>')
    expect(markup).toContain('<option value="entregada">Completadas</option>')
    expect(markup).toContain('<option value="cancelada">Canceladas</option>')
    expect(markup).toContain('>Completada</span>')
  })
})
