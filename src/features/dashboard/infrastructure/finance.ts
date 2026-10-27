import { requireSupabase } from '@/shared/infrastructure/supabase'

export const expenseCategories = [
  'combustible',
  'vehiculo',
  'peajes',
  'seguros',
  'suministros',
  'material',
  'servicios_profesionales',
  'suscripciones',
  'impuestos',
  'otros',
] as const
export type ExpenseCategory = string

export const EXPENSE_BUCKET = 'expense-documents'
export const EXPENSE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024
export const EXPENSE_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export type Expense = {
  id: string
  expenseDate: string
  vendor: string
  vendorNif: string
  invoiceReference: string
  concept: string
  category: ExpenseCategory
  netAmount: number
  vatRate: number
  vatAmount: number
  totalAmount: number
  notes: string
  documentPath: string | null
  documentName: string | null
}

export type ExpenseInput = Pick<
  Expense,
  | 'expenseDate'
  | 'vendor'
  | 'vendorNif'
  | 'invoiceReference'
  | 'concept'
  | 'category'
  | 'netAmount'
  | 'vatRate'
  | 'notes'
>

export type FinanceIncome = {
  issuedInvoiceId: string
  invoiceDraftId: string
  issuedOn: string
  invoiceNumber: string
  clientName: string
  clientNif: string
  concept: string
  netAmount: number
  vatAmount: number
  totalAmount: number
}

type ExpenseRow = {
  id: string
  expense_date: string
  vendor: string
  vendor_nif: string
  invoice_reference: string
  concept: string
  category: ExpenseCategory
  net_amount: number | string
  vat_rate: number | string
  vat_amount: number | string
  total_amount: number | string
  notes: string
  document_path: string | null
  document_name: string | null
}

type IncomeRow = {
  issued_invoice_id: string
  invoice_draft_id: string
  issued_on: string
  invoice_number: string
  client_name: string
  client_nif: string
  concept: string
  net_amount: number | string
  vat_amount: number | string
  total_amount: number | string
}

const expenseColumns =
  'id, expense_date, vendor, vendor_nif, invoice_reference, concept, category, net_amount, vat_rate, vat_amount, total_amount, notes, document_path, document_name'

const toExpense = (row: ExpenseRow): Expense => ({
  id: row.id,
  expenseDate: row.expense_date,
  vendor: row.vendor,
  vendorNif: row.vendor_nif,
  invoiceReference: row.invoice_reference,
  concept: row.concept,
  category: row.category,
  netAmount: Number(row.net_amount),
  vatRate: Number(row.vat_rate),
  vatAmount: Number(row.vat_amount),
  totalAmount: Number(row.total_amount),
  notes: row.notes,
  documentPath: row.document_path,
  documentName: row.document_name,
})

const toIncome = (row: IncomeRow): FinanceIncome => ({
  issuedInvoiceId: row.issued_invoice_id,
  invoiceDraftId: row.invoice_draft_id,
  issuedOn: row.issued_on,
  invoiceNumber: row.invoice_number,
  clientName: row.client_name,
  clientNif: row.client_nif,
  concept: row.concept,
  netAmount: Number(row.net_amount),
  vatAmount: Number(row.vat_amount),
  totalAmount: Number(row.total_amount),
})

const toRow = (input: ExpenseInput) => ({
  expense_date: input.expenseDate,
  vendor: input.vendor.trim(),
  vendor_nif: input.vendorNif.trim(),
  invoice_reference: input.invoiceReference.trim(),
  concept: input.concept.trim(),
  category: input.category,
  net_amount: input.netAmount,
  vat_rate: input.vatRate,
  notes: input.notes.trim(),
})

export async function loadFinanceIncome(from: string, to: string): Promise<FinanceIncome[]> {
  const { data, error } = await requireSupabase().rpc('list_finance_income', {
    p_from: from || null,
    p_to: to || null,
  })
  if (error) throw error
  return ((data ?? []) as IncomeRow[]).map(toIncome)
}

export async function loadExpenses(from: string, to: string): Promise<Expense[]> {
  let request = requireSupabase()
    .from('expenses')
    .select(expenseColumns)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (from) request = request.gte('expense_date', from)
  if (to) request = request.lte('expense_date', to)
  const { data, error } = await request
  if (error) throw error
  return ((data ?? []) as ExpenseRow[]).map(toExpense)
}

export async function saveExpense(
  input: ExpenseInput,
  options: { id?: string; userId?: string; file?: File | null; removeDocument?: boolean },
): Promise<Expense> {
  const supabase = requireSupabase()
  const { data: current, error: currentError } = options.id
    ? await supabase
        .from('expenses')
        .select('document_path')
        .eq('id', options.id)
        .single<{ document_path: string | null }>()
    : { data: null, error: null }
  if (currentError) throw currentError

  const row = options.id
    ? supabase.from('expenses').update(toRow(input)).eq('id', options.id)
    : supabase.from('expenses').insert({ ...toRow(input), created_by: options.userId })
  const { data, error } = await row.select(expenseColumns).single<ExpenseRow>()
  if (error) throw error

  const previousPath = current?.document_path ?? null
  if (!options.file && !(options.removeDocument && previousPath)) return toExpense(data)

  let documentPatch: { document_path: string | null; document_name: string | null } = {
    document_path: null,
    document_name: null,
  }
  if (options.file) {
    const path = `${data.id}/${crypto.randomUUID()}-${safeFileName(options.file.name)}`
    const upload = await supabase.storage
      .from(EXPENSE_BUCKET)
      .upload(path, options.file, { contentType: options.file.type, upsert: false })
    if (upload.error) throw upload.error
    documentPatch = { document_path: path, document_name: options.file.name }
  }
  const { data: updated, error: updateError } = await supabase
    .from('expenses')
    .update(documentPatch)
    .eq('id', data.id)
    .select(expenseColumns)
    .single<ExpenseRow>()
  if (updateError) {
    if (documentPatch.document_path)
      await supabase.storage.from(EXPENSE_BUCKET).remove([documentPatch.document_path])
    throw updateError
  }
  if (previousPath) await supabase.storage.from(EXPENSE_BUCKET).remove([previousPath])
  return toExpense(updated)
}

export async function deleteExpense(expense: Expense) {
  const supabase = requireSupabase()
  const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
  if (error) throw error
  if (expense.documentPath)
    await supabase.storage.from(EXPENSE_BUCKET).remove([expense.documentPath])
}

export async function createExpenseDocumentUrl(path: string): Promise<string> {
  const { data, error } = await requireSupabase()
    .storage.from(EXPENSE_BUCKET)
    .createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}

function safeFileName(name: string) {
  const cleaned = name.replace(/[^\w.-]+/g, '_').replace(/^\.+/, '')
  return cleaned.slice(-80) || 'factura'
}
