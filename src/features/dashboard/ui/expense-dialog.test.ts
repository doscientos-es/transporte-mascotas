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

import { initialSupplierSelection } from '../application/expense-suppliers'
import type { Expense } from '../application/finance'
import { ExpenseCategoryField } from './expense-category-field'
import { ExpenseDialog } from './expense-dialog'
import { ExpenseSupplierField } from './expense-supplier-field'

describe('ExpenseDialog category input', () => {
  it('offers suggested categories in a free-text input', () => {
    const markup = renderToStaticMarkup(
      createElement(ExpenseCategoryField, {
        value: 'Otros',
        onChange: () => {},
      }),
    )

    expect(markup).toContain('aria-label="Categoría"')
    expect(markup).toContain('placeholder="Ej. combustible o mantenimiento"')
    expect(markup).toContain('list="expense-category-suggestions"')
    expect(markup).toContain('<datalist id="expense-category-suggestions">')
    expect(markup).toContain('value="combustible"')
    expect(markup).toContain('label="Combustible"')
    expect(markup).not.toContain('<select')
  })
})

describe('ExpenseDialog field guidance', () => {
  it('shows examples and explains required fields and the tax calculation', () => {
    const markup = renderToStaticMarkup(
      createElement(ExpenseDialog, { expense: null, onClose: vi.fn(), onSubmit: vi.fn() }),
    )
    expect(markup).toContain(
      'Obligatorios: fecha, categoría, proveedor, concepto y base imponible.',
    )
    expect(markup).toContain('Calculado a partir de la base y el IVA.')
    expect(markup).toContain('expense-form-layout')
    expect(markup).toContain('Datos del gasto')
    for (const example of [
      'Ej. F-2026-001',
      'Ej. Cambio de neumáticos',
      'Ej. 100,00',
      'Ej. Pago realizado con tarjeta',
    ]) {
      expect(markup).toContain(`placeholder="${example}"`)
    }
    expect(markup).toMatch(/Concepto<input[^>]*aria-required="true"/)
    expect(markup).toMatch(/Base imponible \(€\)<input[^>]*aria-required="true"/)
  })
})

describe('ExpenseDialog supplier choice', () => {
  it('asks for a saved or new supplier before displaying manual fields', () => {
    const markup = renderToStaticMarkup(
      createElement(ExpenseDialog, { expense: null, onClose: vi.fn(), onSubmit: vi.fn() }),
    )
    expect(markup).toContain('Tipo de proveedor')
    expect(markup).toContain('Guardado')
    expect(markup).toContain('Nuevo')
    expect(markup).toContain('Buscar por nombre o NIF/CIF')
    expect(markup).not.toContain('Ej. Taller de vehículos')
  })

  it('shows editable manual fields when adding a new supplier', () => {
    const markup = renderToStaticMarkup(
      createElement(ExpenseSupplierField, {
        selection: { ...initialSupplierSelection(), mode: 'new' },
        dispatch: vi.fn(),
      }),
    )
    expect(markup).toMatch(/Proveedor<input[^>]*aria-required="true"/)
    expect(markup).toMatch(/NIF\/CIF del proveedor<input[^>]*maxLength="40"/)
    expect(markup).toMatch(/Dirección fiscal del proveedor<input[^>]*maxLength="300"/)
    expect(markup).toContain('Ej. Calle Mayor 10, 28001 Madrid')
  })

  it('summarizes a supplier chosen from the directory and permits editing', () => {
    const markup = renderToStaticMarkup(
      createElement(ExpenseDialog, {
        expense: null,
        initialSupplier: {
          id: 'supplier-1',
          name: 'Taller',
          nif: 'B123',
          address: 'Calle Mayor 1',
        },
        onClose: vi.fn(),
        onSubmit: vi.fn(),
      }),
    )
    expect(markup).toContain('<strong>Taller</strong>')
    expect(markup).toContain('NIF/CIF: B123')
    expect(markup).toContain('Dirección fiscal: Calle Mayor 1')
    expect(markup).toContain('Cambiar proveedor')
    expect(markup).toContain('Editar datos')
    expect(markup).not.toContain('Ej. Taller de vehículos')
  })

  it('preserves the fiscal details stored on an existing expense', () => {
    const expense = {
      vendor: 'Anterior',
      vendorNif: 'B456',
      vendorAddress: 'Calle 2',
      category: 'otros',
    } as Expense
    const markup = renderToStaticMarkup(
      createElement(ExpenseDialog, {
        expense,
        initialSupplier: { id: 'other', name: 'Otro', nif: 'X', address: 'Otra calle' },
        onClose: vi.fn(),
        onSubmit: vi.fn(),
      }),
    )
    expect(markup).toContain('<strong>Anterior</strong>')
    expect(markup).toContain('NIF/CIF: B456')
    expect(markup).toContain('Dirección fiscal: Calle 2')
    expect(markup).not.toContain('<strong>Otro</strong>')
  })
})
