export {
  EXPENSE_SUPPLIER_PAGE_SIZE,
  loadExpenseSupplierPage,
  searchExpenseSuppliers,
} from '../infrastructure/expense-suppliers'
export type { ExpenseSupplier } from '../infrastructure/expense-suppliers'

import type { ExpenseSupplier } from '../infrastructure/expense-suppliers'

export function expenseSupplierFields(supplier: ExpenseSupplier) {
  return { vendor: supplier.name, vendorNif: supplier.nif, vendorAddress: supplier.address }
}

export type SupplierFields = ReturnType<typeof expenseSupplierFields>
export type SupplierSelection = {
  mode: 'lookup' | 'selected' | 'new' | 'edit'
  fields: SupplierFields
  savedDraft?: { mode: 'lookup' | 'selected' | 'edit'; fields: SupplierFields }
  newDraft?: SupplierFields
}
export type SupplierSelectionAction =
  | { type: 'lookup' }
  | { type: 'new' }
  | { type: 'saved-tab' }
  | { type: 'select'; supplier: ExpenseSupplier }
  | { type: 'edit' }
  | { type: 'finish-edit' }
  | { type: 'update'; fields: SupplierFields }

export function initialSupplierSelection(fields?: SupplierFields): SupplierSelection {
  return {
    mode: fields?.vendor ? 'selected' : 'lookup',
    fields: fields ?? { vendor: '', vendorNif: '', vendorAddress: '' },
  }
}

export function supplierSelectionReducer(
  state: SupplierSelection,
  action: SupplierSelectionAction,
): SupplierSelection {
  switch (action.type) {
    case 'lookup':
      return { ...state, ...initialSupplierSelection() }
    case 'new':
      if (state.mode === 'new') return state
      return {
        ...state,
        savedDraft: { mode: state.mode, fields: state.fields },
        mode: 'new',
        fields: state.newDraft ?? initialSupplierSelection().fields,
      }
    case 'saved-tab':
      if (state.mode !== 'new') return state
      return {
        ...state,
        newDraft: state.fields,
        ...(state.savedDraft ?? initialSupplierSelection()),
      }
    case 'select':
      return { ...state, mode: 'selected', fields: expenseSupplierFields(action.supplier) }
    case 'edit':
      return { ...state, mode: 'edit' }
    case 'finish-edit':
      return { ...state, mode: 'selected' }
    case 'update':
      return { ...state, fields: action.fields }
  }
}
