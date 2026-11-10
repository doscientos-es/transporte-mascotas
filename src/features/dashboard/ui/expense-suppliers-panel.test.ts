import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ExpenseSupplierTable } from './expense-suppliers-panel'

describe('expense supplier directory', () => {
  it('shows fiscal details and an action to start an expense for each supplier', () => {
    const markup = renderToStaticMarkup(
      createElement(ExpenseSupplierTable, {
        suppliers: [
          { id: '1', name: 'Taller Norte', nif: 'B123', address: 'Calle Mayor 1' },
          { id: '2', name: 'Peajes', nif: '', address: '' },
        ],
        onNewExpense: vi.fn(),
      }),
    )
    expect(markup).toContain('Taller Norte')
    expect(markup).toContain('B123')
    expect(markup).toContain('Calle Mayor 1')
    expect(markup).toContain('aria-label="Nuevo gasto para Taller Norte"')
    expect(markup).toContain('aria-label="Nuevo gasto para Peajes"')
    expect(markup).toContain('<td>—</td>')
  })
})
