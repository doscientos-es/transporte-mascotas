import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { RouteTemplate } from '@/shared/types'

import { TemplatesPage } from './templates-page'

describe('TemplatesPage stop reordering', () => {
  it('exposes keyboard instructions and each stop position to assistive technology', () => {
    const selected: RouteTemplate = {
      id: 'template-1',
      name: 'Costa',
      color: '#b51e27',
      stops: [
        {
          id: 'stop-1',
          locality: 'Mataró',
          alias: 'Clínica Sol',
          place: 'Entrada principal',
          mapUrl: '',
          minutes: 25,
        },
        { id: 'stop-2', locality: 'Barcelona', place: '', mapUrl: '', minutes: 0 },
      ],
    }
    const markup = renderToStaticMarkup(
      createElement(TemplatesPage, {
        templates: [selected],
        selected,
        createRequestId: 0,
        onSelect: vi.fn(),
        onCreate: async () => {},
        onDuplicate: async () => {},
        onUpdate: async () => {},
        onDelete: async () => {},
        onAddStop: async () => {},
        onUpdateStop: async () => {},
        onDeleteStop: async () => {},
        onReorderStops: async () => {},
        onRecalculateTimes: async () => {},
      }),
    )

    expect(markup).toContain('aria-label="Mover Mataró, posición 1 de 2"')
    expect(markup).toContain('aria-keyshortcuts="ArrowUp ArrowDown"')
    expect(markup).toContain('id="template-reorder-help"')
    expect(markup).toContain('Arrastra el asa para mover la parada')
    expect(markup).toContain('aria-label="Editar parada Mataró"')
    expect(markup).toContain('aria-label="Eliminar parada Mataró"')
    expect(markup.indexOf('class="template-stop-drag"')).toBeLessThan(
      markup.indexOf('class="stop-index"'),
    )
    expect(markup).toContain('<span class="template-leg-time">Mataró → Barcelona · 25 min</span>')
    expect(markup).toContain('<p>Clínica Sol · Entrada principal</p>')
    expect(markup).toContain('aria-label="Más opciones de la plantilla"')
    expect(markup).not.toContain('class="duration"')
  })
})
