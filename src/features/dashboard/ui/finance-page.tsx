import { Button } from '@doscientos/ui'
import { Download, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  createExpenseDocumentUrl,
  deleteExpense,
  loadExpenses,
  loadFinanceIncome,
  saveExpense,
  type Expense,
  type FinanceIncome,
} from '../application/finance'
import {
  expenseCategoryLabels,
  expensesByCategory,
  expensesToCsv,
  incomeToCsv,
  monthlyBreakdown,
  movementsToCsv,
  summarizeFinance,
} from '../application/finance-summary'
import { downloadBlob } from './billing-document-export'
import { ExpenseDialog, type ExpenseSubmit } from './expense-dialog'

const money = (value: number) =>
  value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
const monthLabel = (month: string) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
const csvBlob = (content: string) => new Blob([content], { type: 'text/csv;charset=utf-8' })

export function FinancePage({ userId }: { userId?: string }) {
  const year = new Date().getFullYear()
  const [from, setFrom] = useState(`${year}-01-01`)
  const [to, setTo] = useState(`${year}-12-31`)
  const [income, setIncome] = useState<FinanceIncome[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)

  const reload = useCallback(async () => {
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
      !window.confirm(
        `Â¿Eliminar el gasto "${expense.concept}"? Esta acciÃ³n no se puede deshacer.`,
      )
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

  const profitClass = totals.profit < 0 ? 'finance-negative' : 'finance-positive'

  return (
    <>
      <section className="invoice-page-heading" aria-label="Finanzas">
        <div>
          <h2>Finanzas</h2>
          <p>Ingresos de las facturas emitidas frente a los gastos del negocio.</p>
        </div>
      </section>

      <section className="invoice-filter-surface" aria-label="Periodo">
        <div className="invoice-filter-heading">
          <strong>Periodo</strong>
          <div className="finance-actions">
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
        </div>
        <div className="invoice-filters">
          <label>
            Desde
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </section>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <section className="finance-cards" aria-live="polite" aria-busy={loading}>
        <article>
          <span>Ingresos (base)</span>
          <strong>{money(totals.incomeNet)}</strong>
          <small>
            {income.length} facturas Â· IVA {money(totals.incomeVat)}
          </small>
        </article>
        <article>
          <span>Gastos (base)</span>
          <strong>{money(totals.expenseNet)}</strong>
          <small>
            {expenses.length} gastos Â· IVA {money(totals.expenseVat)}
          </small>
        </article>
        <article>
          <span>Beneficio</span>
          <strong className={profitClass}>{money(totals.profit)}</strong>
          <small>
            {totals.margin === null
              ? 'Sin ingresos'
              : `Margen ${totals.margin.toLocaleString('es-ES')} %`}
          </small>
        </article>
        <article>
          <span>IVA a liquidar</span>
          <strong>{money(totals.vatBalance)}</strong>
          <small>{totals.vatBalance >= 0 ? 'Repercutido âˆ’ soportado' : 'A compensar'}</small>
        </article>
      </section>

      <section className="finance-panel">
        <h3>Por mes</h3>
        {months.length ? (
          <table className="finance-table">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Ingresos</th>
                <th>Gastos</th>
                <th>Beneficio</th>
              </tr>
            </thead>
            <tbody>
              {months.map((row) => (
                <tr key={row.month}>
                  <td>{monthLabel(row.month)}</td>
                  <td>{money(row.incomeNet)}</td>
                  <td>{money(row.expenseNet)}</td>
                  <td className={row.profit < 0 ? 'finance-negative' : 'finance-positive'}>
                    {money(row.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="finance-empty">
            {loading ? 'Cargandoâ€¦' : 'No hay movimientos en este periodo.'}
          </p>
        )}
      </section>

      {categories.length > 0 && (
        <section className="finance-panel">
          <h3>Gastos por categorÃ­a</h3>
          <table className="finance-table">
            <tbody>
              {categories.map((row) => (
                <tr key={row.category}>
                  <td>{expenseCategoryLabels[row.category]}</td>
                  <td>{money(row.netAmount)}</td>
                  <td>{row.share.toLocaleString('es-ES')} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="finance-panel">
        <div className="finance-panel-heading">
          <h3>Gastos</h3>
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus size={15} /> Nuevo gasto
          </Button>
        </div>
        {expenses.length ? (
          <table className="finance-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Concepto</th>
                <th>CategorÃ­a</th>
                <th>Total</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{new Date(`${expense.expenseDate}T12:00:00`).toLocaleDateString('es-ES')}</td>
                  <td>{expense.vendor}</td>
                  <td>{expense.concept}</td>
                  <td>{expenseCategoryLabels[expense.category]}</td>
                  <td>{money(expense.totalAmount)}</td>
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
        ) : (
          <p className="finance-empty">
            {loading ? 'Cargandoâ€¦' : 'TodavÃ­a no hay gastos en este periodo.'}
          </p>
        )}
      </section>

      {editing && (
        <ExpenseDialog
          expense={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={submitExpense}
        />
      )}
    </>
  )
}
