import { describe, expect, it } from 'vitest'

import {
  expenseSupplierFields,
  initialSupplierSelection,
  supplierSelectionReducer,
} from './expense-suppliers'

describe('expense supplier fields', () => {
  it('copies name, NIF and fiscal address without the directory identity', () => {
    expect(
      expenseSupplierFields({ id: '1', name: 'Proveedor', nif: 'B123', address: 'Calle 1' }),
    ).toEqual({ vendor: 'Proveedor', vendorNif: 'B123', vendorAddress: 'Calle 1' })
  })

  it('clears missing fields rather than retaining data from another provider', () => {
    expect(expenseSupplierFields({ id: '2', name: 'Nuevo', nif: '', address: '' })).toEqual({
      vendor: 'Nuevo',
      vendorNif: '',
      vendorAddress: '',
    })
  })
})

describe('supplier selection', () => {
  it('selects, edits and replaces fiscal data without retaining the previous supplier', () => {
    const first = { id: '1', name: 'Taller', nif: 'B123', address: 'Calle 1' }
    const second = { id: '2', name: 'Peajes', nif: '', address: '' }
    let state = supplierSelectionReducer(initialSupplierSelection(), {
      type: 'select',
      supplier: first,
    })
    expect(state).toEqual({ mode: 'selected', fields: expenseSupplierFields(first) })
    state = supplierSelectionReducer(state, { type: 'edit' })
    state = supplierSelectionReducer(state, {
      type: 'update',
      fields: { ...state.fields, vendorAddress: 'Calle 2' },
    })
    state = supplierSelectionReducer(state, { type: 'finish-edit' })
    expect(state.fields.vendorAddress).toBe('Calle 2')
    state = supplierSelectionReducer(state, { type: 'lookup' })
    expect(state.fields.vendor).toBe('')
    state = supplierSelectionReducer(state, { type: 'select', supplier: second })
    expect(state.fields).toEqual({ vendor: 'Peajes', vendorNif: '', vendorAddress: '' })
    state = supplierSelectionReducer(state, { type: 'new' })
    expect(state.mode).toBe('new')
    expect(state.fields).toEqual({ vendor: '', vendorNif: '', vendorAddress: '' })
  })

  it('preserves both drafts when switching tabs without submitting hidden supplier data', () => {
    const saved = { id: '1', name: 'Taller', nif: 'B123', address: 'Calle 1' }
    let state = supplierSelectionReducer(initialSupplierSelection(), {
      type: 'select',
      supplier: saved,
    })
    state = supplierSelectionReducer(state, { type: 'new' })
    const newFields = { vendor: 'Nuevo', vendorNif: 'B456', vendorAddress: 'Calle 2' }
    state = supplierSelectionReducer(state, { type: 'update', fields: newFields })
    state = supplierSelectionReducer(state, { type: 'saved-tab' })
    expect(state.mode).toBe('selected')
    expect(state.fields).toEqual(expenseSupplierFields(saved))
    state = supplierSelectionReducer(state, { type: 'new' })
    expect(state.mode).toBe('new')
    expect(state.fields).toEqual(newFields)
  })
})
