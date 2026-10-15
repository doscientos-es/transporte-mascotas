import type { Expense, ExpenseCategory, FinanceIncome } from '../infrastructure/finance'

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  combustible: 'Combustible',
  vehiculo: 'Vehículo y mantenimiento',
  peajes: 'Peajes y parking',
  seguros: 'Seguros',
  suministros: 'Suministros',
  material: 'Material',
  servicios_profesionales: 'Servicios profesionales',
  suscripciones: 'Suscripciones y software',
  impuestos: 'Impuestos y tasas',
  otros: 'Otros',
}

export type FinanceTotals = {
  incomeNet: number
  incomeVat: number
  incomeTotal: number
  expenseNet: number
  expenseVat: number
  expenseTotal: number
  /** Net income minus net expenses (VAT is not profit). */
  profit: number
  /** VAT charged minus VAT paid: positive means VAT owed to the tax office. */
  vatBalance: number
  /** Profit as a percentage of net income; null when there is no income. */
  margin: number | null
}

export type FinanceMonth = {
  month: string
  incomeNet: number
  expenseNet: number
  profit: number
}

export type CategoryTotal = { category: ExpenseCategory; netAmount: number; share: number }

const cents = (value: number) => Math.round(value * 100)
const euros = (value: number) => value / 100

function sumBy<T>(items: T[], pick: (item: T) => number) {
  return euros(items.reduce((total, item) => total + cents(pick(item)), 0))
}

export function summarizeFinance(income: FinanceIncome[], expenses: Expense[]): FinanceTotals {
  const incomeNet = sumBy(income, (item) => item.netAmount)
  const incomeVat = sumBy(income, (item) => item.vatAmount)
  const incomeTotal = sumBy(income, (item) => item.totalAmount)
  const expenseNet = sumBy(expenses, (item) => item.netAmount)
  const expenseVat = sumBy(expenses, (item) => item.vatAmount)
  const expenseTotal = sumBy(expenses, (item) => item.totalAmount)
  const profit = euros(cents(incomeNet) - cents(expenseNet))
  return {
    incomeNet,
    incomeVat,
    incomeTotal,
    expenseNet,
    expenseVat,
    expenseTotal,
    profit,
    vatBalance: euros(cents(incomeVat) - cents(expenseVat)),
    margin: incomeNet > 0 ? Math.round((profit / incomeNet) * 1000) / 10 : null,
  }
}

/** Groups income and expenses by calendar month (YYYY-MM), newest first. */
export function monthlyBreakdown(income: FinanceIncome[], expenses: Expense[]): FinanceMonth[] {
  const months = new Map<string, { incomeNet: number; expenseNet: number }>()
  const bucket = (date: string) => {
    const key = date.slice(0, 7)
    const existing = months.get(key) ?? { incomeNet: 0, expenseNet: 0 }
    months.set(key, existing)
    return existing
  }
  for (const item of income) bucket(item.issuedOn).incomeNet += cents(item.netAmount)
  for (const item of expenses) bucket(item.expenseDate).expenseNet += cents(item.netAmount)
  return [...months.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, value]) => ({
      month,
      incomeNet: euros(value.incomeNet),
      expenseNet: euros(value.expenseNet),
      profit: euros(value.incomeNet - value.expenseNet),
    }))
}

/** Net expenses per category, largest first, with the share of all expenses. */
export function expensesByCategory(expenses: Expense[]): CategoryTotal[] {
  const totals = new Map<ExpenseCategory, number>()
  for (const item of expenses)
    totals.set(item.category, (totals.get(item.category) ?? 0) + cents(item.netAmount))
  const all = [...totals.values()].reduce((sum, value) => sum + value, 0)
  return [...totals.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([category, value]) => ({
      category,
      netAmount: euros(value),
      share: all > 0 ? Math.round((value / all) * 1000) / 10 : 0,
    }))
}

const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
const csv = (rows: Array<Array<string | number>>) =>
  `\uFEFF${rows.map((row) => row.map(cell).join(';')).join('\n')}`

export function incomeToCsv(income: FinanceIncome[]) {
  return csv([
    ['Fecha', 'Nº factura', 'Cliente', 'NIF/CIF', 'Concepto', 'Base', 'IVA', 'Total'],
    ...income.map((item) => [
      item.issuedOn,
      item.invoiceNumber,
      item.clientName,
      item.clientNif,
      item.concept,
      item.netAmount.toFixed(2),
      item.vatAmount.toFixed(2),
      item.totalAmount.toFixed(2),
    ]),
  ])
}

export function expensesToCsv(expenses: Expense[]) {
  return csv([
    [
      'Fecha',
      'Proveedor',
      'NIF/CIF',
      'Nº factura',
      'Concepto',
      'Categoría',
      'Base',
      'IVA %',
      'IVA',
      'Total',
    ],
    ...expenses.map((item) => [
      item.expenseDate,
      item.vendor,
      item.vendorNif,
      item.invoiceReference,
      item.concept,
      expenseCategoryLabels[item.category],
      item.netAmount.toFixed(2),
      item.vatRate,
      item.vatAmount.toFixed(2),
      item.totalAmount.toFixed(2),
    ]),
  ])
}

/** Ledger of every movement (income positive, expense negative), newest first. */
export function movementsToCsv(income: FinanceIncome[], expenses: Expense[]) {
  const movements = [
    ...income.map((item) => ({
      date: item.issuedOn,
      type: 'Ingreso',
      reference: item.invoiceNumber,
      party: item.clientName,
      concept: item.concept,
      net: item.netAmount,
      vat: item.vatAmount,
      total: item.totalAmount,
    })),
    ...expenses.map((item) => ({
      date: item.expenseDate,
      type: 'Gasto',
      reference: item.invoiceReference,
      party: item.vendor,
      concept: item.concept,
      net: -item.netAmount,
      vat: -item.vatAmount,
      total: -item.totalAmount,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))
  return csv([
    ['Fecha', 'Tipo', 'Referencia', 'Cliente/Proveedor', 'Concepto', 'Base', 'IVA', 'Total'],
    ...movements.map((item) => [
      item.date,
      item.type,
      item.reference,
      item.party,
      item.concept,
      item.net.toFixed(2),
      item.vat.toFixed(2),
      item.total.toFixed(2),
    ]),
  ])
}

export const money = (value: number) =>
  value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
export const percent = (value: number) => `${value.toLocaleString('es-ES')} %`
const parseMonth = (month: string) => new Date(`${month}-01T12:00:00`)
export const monthLabel = (month: string) =>
  parseMonth(month).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
export const shortMonth = (month: string) =>
  parseMonth(month).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
export const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('es-ES')
