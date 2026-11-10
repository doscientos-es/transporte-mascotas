import type * as Ui from '@doscientos/ui'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@doscientos/ui', async (importOriginal) => {
  const original = await importOriginal<typeof Ui>()
  const passthrough = ({ children }: { children: ReactNode }) => children
  return {
    ...original,
    Dialog: passthrough,
    DialogContent: passthrough,
    DialogDescription: passthrough,
    DialogHeader: passthrough,
    DialogTitle: passthrough,
  }
})

import type { Expense } from '../application/finance'
import { ExpenseCategoryField } from './expense-category-field'
import { ExpenseDialog } from './expense-dialog'

describe('ExpenseDialog category input', () => {
  it('offers suggested categories in a free-text input', () => {
    const markup = renderToStaticMarkup(
      createElement(ExpenseCategoryField, {
        value: 'Otros',
        onChange: () => {},
      }),
    )

    expect(markup).toContain('aria-label="Categoría"')
    expect(markup).toContain('list="expense-category-suggestions"')
    expect(markup).toContain('<datalist id="expense-category-suggestions">')
    expect(markup).toContain('value="combustible"')
    expect(markup).toContain('label="Combustible"')
    expect(markup).not.toContain('<select')
  })
})

describe('ExpenseDialog fiscal address', () => {
  it.each([
    [null, ''],
    [
      { vendorAddress: 'Calle Mayor 1, Madrid', category: 'otros' } as Expense,
      'Calle Mayor 1, Madrid',
    ],
  ])('shows the optional address when creating or editing an expense', (expense, address) => {
    const markup = renderToStaticMarkup(
      createElement(ExpenseDialog, { expense, onClose: vi.fn(), onSubmit: vi.fn() }),
    )
    const field = markup.match(/Dirección fiscal del proveedor<input[^>]*>/)?.[0]
    expect(field).toContain(`value="${address}"`)
    expect(field).toContain('maxLength="300"')
    expect(field).not.toContain('required')
  })
})
