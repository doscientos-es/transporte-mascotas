export { searchExpenseSuppliers } from '../infrastructure/expense-suppliers'
export type { ExpenseSupplier } from '../infrastructure/expense-suppliers'

import type { ExpenseSupplier } from '../infrastructure/expense-suppliers'

export function expenseSupplierFields(supplier: ExpenseSupplier) {
  return { vendor: supplier.name, vendorNif: supplier.nif, vendorAddress: supplier.address }
}
