import { describe, expect, it } from 'vitest'

import { expenseSupplierFields } from './expense-suppliers'

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
