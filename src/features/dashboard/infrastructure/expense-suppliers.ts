import { requireSupabase } from '@/shared/infrastructure/supabase'

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
