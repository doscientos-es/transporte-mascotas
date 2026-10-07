import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Stat } from './stat'

describe('Stat', () => {
  it('uses reduced spacing and type sizes when compact', () => {
    const markup = renderToStaticMarkup(
      createElement(Stat, { label: 'En transporte', value: 3, compact: true }),
    )

    expect(markup).toContain('[--card-spacing:10px]')
    expect(markup).toContain('border-0')
    expect(markup).not.toContain('border-t-[3px]')
    expect(markup).toContain('text-[24px]')
    expect(markup).toContain('grid-cols-[auto_minmax(0,1fr)]')
    expect(markup).toContain('col-start-1')
    expect(markup).toContain('col-start-2')
    expect(markup).not.toContain('lucide-clipboard-list')
    expect(markup).not.toContain('Actualizado ahora')
  })

  it('shows a green check when a metric configured for success reaches zero', () => {
    const markup = renderToStaticMarkup(
      createElement(Stat, {
        label: 'Necesita revisión',
        value: 0,
        successWhenZero: true,
        compact: true,
      }),
    )

    expect(markup).toContain('data-tone="success"')
    expect(markup).toContain('lucide-check')
    expect(markup).toContain('bg-[#f1faf3]')
    expect(markup).toContain('border-0')
    expect(markup).not.toContain('border-t-[3px]')
  })

  it('keeps a positive value in the neutral state', () => {
    const markup = renderToStaticMarkup(
      createElement(Stat, { label: 'Necesita revisión', value: 2, successWhenZero: true }),
    )

    expect(markup).toContain('data-tone="default"')
    expect(markup).not.toContain('lucide-check')
  })

  it('keeps the standard sizing by default', () => {
    const markup = renderToStaticMarkup(createElement(Stat, { label: 'En transporte', value: 3 }))

    expect(markup).toContain('[--card-spacing:18px]')
    expect(markup).toContain('text-[31px]')
  })
})
