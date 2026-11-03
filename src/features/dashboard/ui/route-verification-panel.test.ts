import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { VerificationSummary } from '../application/route-verification'
import { RouteVerificationPanel, type VerificationStatus } from './route-verification-panel'

const summary: VerificationSummary = {
  googleMinutes: 100,
  savedMinutes: 100,
  differenceMinutes: 0,
  matches: false,
  kilometers: 101.4,
  legs: [
    { googleMinutes: 40, savedMinutes: 70, legLabel: '40 min · 41 km' },
    { googleMinutes: 60, savedMinutes: 30, legLabel: '1 h 00 min · 60 km' },
  ],
}

function render(status: VerificationStatus, canApply = true, applying = false) {
  return renderToStaticMarkup(
    createElement(RouteVerificationPanel, {
      status,
      stopNames: ['Barcelona', 'Girona', 'Figueres'],
      canApply,
      applying,
      onApply: vi.fn(),
    }),
  )
}

const ready = (value = summary): VerificationStatus => ({
  kind: 'ready',
  source: 'google',
  calculatedAt: 0,
  summary: value,
})

describe('RouteVerificationPanel', () => {
  it('warns about differing legs even when the route totals are equal', () => {
    const markup = render(ready())

    expect(markup).toContain('Hay diferencias entre tramos')
    expect(markup).not.toContain('Google calcula 0 min')
    expect(markup).toContain('Usar tiempos de Google')
    expect(markup).toContain('Barcelona → Girona')
    expect(markup).toContain('guardado: 1 h 10 min')
  })

  it('keeps the verified summary compact and puts extra information inside the disclosure', () => {
    const markup = render(ready({ ...summary, matches: true }))
    const disclosureStart = markup.indexOf('<details')
    const overview = markup.slice(0, disclosureStart)
    const details = markup.slice(disclosureStart)

    expect(overview).toContain('Verificado con Google Maps')
    expect(overview).toContain('1 h 40 min')
    expect(overview).toContain('101 km')
    expect(overview).not.toContain('margen de tolerancia')
    expect(overview).not.toContain('Comprobado')
    expect(overview).not.toContain('Sin tráfico')
    expect(details).toContain('<summary>Ver tramos (2)</summary>')
    expect(details).toContain('Sin tráfico en tiempo real')
    expect(details).toContain('no incluye las paradas')
    expect(details).toContain('Comprobado a las')
    expect(markup).not.toContain('Usar tiempos de Google')
  })

  it('does not offer to change times without edit permission and disables repeated saves', () => {
    expect(render(ready(), false)).not.toContain('Usar tiempos de Google')
    const markup = render(ready(), true, true)
    expect(markup).toContain('Aplicando…')
    expect(markup).toMatch(/<button[^>]*disabled/)
  })

  it('announces checking and failure states without displaying verified totals', () => {
    const checking = render({ kind: 'checking', progress: { phase: 'google' } })
    expect(checking).toContain('Comprobando con Google Maps')
    expect(checking).toContain('aria-live="polite"')
    const unavailable = render({ kind: 'unavailable' })
    expect(unavailable).toContain('Sin verificación de Google Maps')
    expect(unavailable).not.toContain('route-verify-totals')
  })
})
