import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ReorderList } from './reorder-list-dialog'

const items = [
  { id: 'pickup', title: 'Recogida · Ana · Box 13', description: 'Labrador' },
  { id: 'delivery', title: 'Entrega · Luis · Box 20', description: 'Gato' },
]

describe('ReorderList accessibility', () => {
  it('exposes ordered semantics, keyboard instructions, non-drag controls and live announcements', () => {
    const markup = renderToStaticMarkup(<ReorderList items={items} onChange={vi.fn()} />)
    expect(markup).toContain('<ol')
    expect(markup).toContain('aria-label="Mover Recogida · Ana · Box 13, posición 1 de 2"')
    expect(markup).toContain('aria-keyshortcuts="ArrowUp ArrowDown"')
    expect(markup).toContain('aria-describedby=')
    expect(markup).toContain(
      '<output class="reorder-drop-hint" aria-live="polite" aria-atomic="true"',
    )
    expect(markup).toContain('aria-label="Subir Recogida · Ana · Box 13" aria-disabled="true"')
    expect(markup).toContain('aria-label="Bajar Recogida · Ana · Box 13" aria-disabled="false"')
    expect(markup).toContain('aria-label="Bajar Entrega · Luis · Box 20" aria-disabled="true"')
    expect(markup.indexOf('Labrador')).toBeLessThan(markup.indexOf('Gato'))
  })

  it('marks every movement control unavailable while saving without removing it from tab order', () => {
    const markup = renderToStaticMarkup(<ReorderList items={items} onChange={vi.fn()} busy />)
    expect(markup).toContain('aria-busy="true"')
    expect(markup.match(/aria-disabled="true"/g)).toHaveLength(6)
    expect(markup).not.toContain('tabindex="-1"')
  })
})
