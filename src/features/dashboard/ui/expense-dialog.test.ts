import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ExpenseCategoryField } from './expense-category-field'

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
