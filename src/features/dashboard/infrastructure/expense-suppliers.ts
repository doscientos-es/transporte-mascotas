import { requireSupabase } from '@/shared/infrastructure/supabase'
import type { PaginatedResult } from '@/shared/types'

export const EXPENSE_SUPPLIER_PAGE_SIZE = 12

export type ExpenseSupplier = {
  id: string
  name: string
  nif: string
  address: string
}

export async function searchExpenseSuppliers(query: string): Promise<ExpenseSupplier[]> {
  const { data, error } = await requireSupabase().rpc('search_expense_suppliers', {
    p_query: query.trim(),
  })
  if (error) throw error
  return (data ?? []) as ExpenseSupplier[]
}

export async function loadExpenseSupplierPage(
  page: number,
  query: string,
): Promise<PaginatedResult<ExpenseSupplier>> {
  const first = (Math.max(1, page) - 1) * EXPENSE_SUPPLIER_PAGE_SIZE
  let request = requireSupabase()
    .from('expense_suppliers')
    .select('id,name,nif,address', { count: 'exact' })
    .order('name')
    .order('id')
    .range(first, first + EXPENSE_SUPPLIER_PAGE_SIZE - 1)
  const name = query
    .trim()
    .slice(0, 160)
    .replace(/[\\%_]/g, '\\$&')
  if (name) request = request.ilike('name', `%${name}%`)
  const { data, error, count } = await request
  if (error) throw error
  return { items: (data ?? []) as ExpenseSupplier[], total: count ?? 0 }
}
