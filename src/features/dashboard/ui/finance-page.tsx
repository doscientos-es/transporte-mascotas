import { Button } from '@doscientos/ui'
import { Download, ExternalLink, Pencil, Plus, Receipt, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  createExpenseDocumentUrl,
  deleteExpense,
  expenseCategories,
  loadExpenses,
  loadFinanceIncome,
  saveExpense,
  type Expense,
  type FinanceIncome,
} from '../application/finance'
import {
  dateLabel,
  expenseCategoryLabels,
  expensesByCategory,
  expensesToCsv,
  incomeToCsv,
  money,
  monthlyBreakdown,
  movementsToCsv,
  summarizeFinance,
} from '../application/finance-summary'
import { downloadBlob } from './billing-document-export'
import { ExpenseDialog, type ExpenseSubmit } from './expense-dialog'
import { CategoryPanel, FinanceKpis, IncomePanel, MonthlyPanel } from './finance-sections'

const csvBlob = (content: string) => new Blob([content], { type: 'text/csv;charset=utf-8' })
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function periodPresets(now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth()
  const quarter = Math.floor(month / 3) * 3
  return [
    {
      id: 'month',
      label: 'Este mes',
      from: iso(new Date(year, month, 1)),
      to: iso(new Date(year, month + 1, 0)),
    },
    {
      id: 'quarter',
      label: 'Trimestre',
      from: iso(new Date(year, quarter, 1)),
      to: iso(new Date(year, quarter + 3, 0)),
    },
    { id: 'year', label: String(year), from: `${year}-01-01`, to: `${year}-12-31` },
    {
      id: 'last-year',
      label: String(year - 1),
      from: `${year - 1}-01-01`,
      to: `${year - 1}-12-31`,
    },
  ]
}

export function FinancePage({ userId }: { userId?: string }) {
  const presets = useMemo(() => periodPresets(), [])
  const [from, setFrom] = useState(presets[2].from)
  const [to, setTo] = useState(presets[2].to)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [income, setIncome] = useState<FinanceIncome[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)

  const reload = useCallback(async () => {
    if (from && to && from > to) return
    setLoading(true)
    setError('')
    try {
      const [nextIncome, nextExpenses] = await Promise.all([
        loadFinanceIncome(from, to),
        loadExpenses(from, to),
      ])
      setIncome(nextIncome)
      setExpenses(nextExpenses)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se han podido cargar las finanzas.')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    void reload()
  }, [reload])

  const totals = useMemo(() => summarizeFinance(income, expenses), [income, expenses])
  const months = useMemo(() => monthlyBreakdown(income, expenses), [income, expenses])
  const categories = useMemo(() => expensesByCategory(expenses), [expenses])
  const stamp = `${from || 'inicio'}_${to || 'hoy'}`
  const activePreset = presets.find((preset) => preset.from === from && preset.to === to)?.id
  const invalidRange = Boolean(from && to && from > to)
  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLowerCase()
    return expenses.filter(
      (expense) =>
        (!category || expense.category === category) &&
        (!term ||
          [expense.vendor, expense.concept, expense.invoiceReference]
            .join(' ')
            .toLowerCase()
            .includes(term)),
    )
  }, [expenses, search, category])
  const filteredTotal = useMemo(
    () => summarizeFinance([], filteredExpenses).expenseTotal,
    [filteredExpenses],
  )
  const hasFilters = Boolean(search || category)
  const clearFilters = () => {
    setSearch('')
    setCategory('')
  }

  async function submitExpense({ input, file, removeDocument }: ExpenseSubmit) {
    await saveExpense(input, {
      id: editing && editing !== 'new' ? editing.id : undefined,
      userId,
      file,
      removeDocument,
    })
    await reload()
  }

  async function removeExpense(expense: Expense) {
    if (
      !window.confirm(`¿Eliminar el gasto "${expense.concept}"? Esta acción no se puede deshacer.`)
    )
      return
    try {
      await deleteExpense(expense)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido eliminar el gasto.')
    }
  }

  async function openDocument(expense: Expense) {
    if (!expense.documentPath) return
    const popup = window.open('', '_blank')
    if (!popup) {
      setError('El navegador ha bloqueado la ventana. Permite las ventanas emergentes.')
      return
    }
    popup.opener = null
    try {
      popup.location.replace(await createExpenseDocumentUrl(expense.documentPath))
    } catch (reason) {
      popup.close()
      setError(reason instanceof Error ? reason.message : 'No se ha podido abrir el justificante.')
    }
  }

  const pickPreset = (preset: (typeof presets)[number]) => {
    setFrom(preset.from)
    setTo(preset.to)
  }

  return (
    <div className="finance-page">
      <section className="finance-hero" aria-label="Finanzas">
        <p>Ingresos de las facturas emitidas frente a los gastos del negocio.</p>
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} /> Nuevo gasto
        </Button>
      </section>

      <section className="finance-toolbar" aria-label="Periodo">
        <div className="finance-presets" aria-label="Periodos rápidos">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={activePreset === preset.id}
              onClick={() => pickPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="finance-range">
          <label>
            Desde
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <div className="finance-actions" aria-label="Exportar a CSV">
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() =>
              downloadBlob(csvBlob(movementsToCsv(income, expenses)), `movimientos-${stamp}.csv`)
            }
          >
            <Download size={15} /> Movimientos
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() =>
              downloadBlob(csvBlob(incomeToCsv(income)), `facturas-emitidas-${stamp}.csv`)
            }
          >
            <Download size={15} /> Facturas
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => downloadBlob(csvBlob(expensesToCsv(expenses)), `gastos-${stamp}.csv`)}
          >
            <Download size={15} /> Gastos
          </Button>
        </div>
      </section>

      {invalidRange && (
        <p className="form-error" role="alert">
          La fecha inicial no puede ser posterior a la final.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <FinanceKpis
        totals={totals}
        incomeCount={income.length}
        expenseCount={expenses.length}
        loading={loading}
      />

      <div className="finance-grid">
        <MonthlyPanel months={months} loading={loading} />
        <CategoryPanel categories={categories} />
      </div>

      <IncomePanel income={income} loading={loading} />

      <section className="finance-panel">
        <div className="finance-panel-heading">
          <h3>Gastos</h3>
          {expenses.length > 0 && (
            <span className="finance-count">
              {hasFilters
                ? `${filteredExpenses.length} de ${expenses.length} · ${money(filteredTotal)}`
                : `${expenses.length} · ${money(filteredTotal)}`}
            </span>
          )}
        </div>
        {expenses.length > 0 && (
          <div className="finance-filters">
            <label className="finance-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                value={search}
                placeholder="Buscar proveedor, concepto o nº de factura"
                aria-label="Buscar gastos"
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              value={category}
              aria-label="Filtrar por categoría"
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {expenseCategories.map((value) => (
                <option key={value} value={value}>
                  {expenseCategoryLabels[value]}
                </option>
              ))}
            </select>
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                Limpiar
              </Button>
            )}
          </div>
        )}
        {filteredExpenses.length ? (
          <div className="finance-table-wrap">
            <table className="finance-table finance-expenses">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Categoría</th>
                  <th className="is-number">Base</th>
                  <th className="is-number">Total</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{dateLabel(expense.expenseDate)}</td>
                    <td>
                      <span className="finance-cell-main">{expense.vendor}</span>
                      <span className="finance-cell-sub">{expense.concept}</span>
                    </td>
                    <td>
                      <span className="finance-badge">
                        {expenseCategoryLabels[expense.category]}
                      </span>
                    </td>
                    <td className="is-number">{money(expense.netAmount)}</td>
                    <td className="is-number is-strong">{money(expense.totalAmount)}</td>
                    <td className="finance-row-actions">
                      {expense.documentPath && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Ver justificante"
                          onClick={() => void openDocument(expense)}
                        >
                          <ExternalLink size={15} />
                        </Button>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Editar gasto"
                        onClick={() => setEditing(expense)}
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Eliminar gasto"
                        onClick={() => void removeExpense(expense)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : loading ? (
          <p className="finance-empty">Cargando…</p>
        ) : hasFilters ? (
          <div className="finance-empty-state">
            <Search size={22} aria-hidden="true" />
            <strong>Ningún gasto coincide con la búsqueda</strong>
            <Button size="sm" variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <div className="finance-empty-state">
            <Receipt size={22} aria-hidden="true" />
            <strong>Todavía no hay gastos en este periodo.</strong>
            <span>Registra combustible, peajes o suministros para ver el beneficio real.</span>
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus size={15} /> Añadir el primer gasto
            </Button>
          </div>
        )}
      </section>

      {editing && (
        <ExpenseDialog
          expense={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={submitExpense}
        />
      )}
    </div>
  )
}
