import { Button } from '@doscientos/ui'
import { Landmark, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useState } from 'react'

import type { FinanceIncome } from '../application/finance'
import {
  dateLabel,
  expenseCategoryLabel,
  monthLabel,
  money,
  percent,
  shortMonth,
  type CategoryTotal,
  type FinanceMonth,
  type FinanceTotals,
} from '../application/finance-summary'

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
const tone = (value: number) => (value < 0 ? 'finance-negative' : 'finance-positive')

export function FinanceKpis({
  totals,
  incomeCount,
  expenseCount,
  loading,
}: {
  totals: FinanceTotals
  incomeCount: number
  expenseCount: number
  loading: boolean
}) {
  const cards = [
    {
      id: 'income',
      label: 'Ingresos',
      icon: TrendingUp,
      value: money(totals.incomeNet),
      note: `${plural(incomeCount, 'factura', 'facturas')} · IVA ${money(totals.incomeVat)}`,
    },
    {
      id: 'expense',
      label: 'Gastos',
      icon: TrendingDown,
      value: money(totals.expenseNet),
      note: `${plural(expenseCount, 'gasto', 'gastos')} · IVA ${money(totals.expenseVat)}`,
    },
    {
      id: totals.profit < 0 ? 'loss' : 'profit',
      label: 'Beneficio',
      icon: Wallet,
      value: money(totals.profit),
      note: totals.margin === null ? 'Sin ingresos' : `Margen ${percent(totals.margin)}`,
    },
    {
      id: 'vat',
      label: 'IVA a liquidar',
      icon: Landmark,
      value: money(totals.vatBalance),
      note: totals.vatBalance >= 0 ? 'Repercutido − soportado' : 'A compensar',
    },
  ]
  return (
    <section
      className={`finance-kpis${loading ? ' is-loading' : ''}`}
      aria-label="Resumen del periodo"
      aria-live="polite"
      aria-busy={loading}
    >
      {cards.map(({ id, label, icon: Icon, value, note }) => (
        <article key={id} className={`finance-kpi finance-kpi-${id}`}>
          <span className="finance-kpi-icon" aria-hidden="true">
            <Icon size={18} />
          </span>
          <span className="finance-kpi-label">{label}</span>
          <strong>{value}</strong>
          <small>{note}</small>
        </article>
      ))}
    </section>
  )
}

export function MonthlyPanel({ months, loading }: { months: FinanceMonth[]; loading: boolean }) {
  const ordered = [...months].reverse()
  const peak = Math.max(1, ...ordered.flatMap((row) => [row.incomeNet, row.expenseNet]))
  const height = (value: number) => `${Math.max(value > 0 ? 3 : 0, (value / peak) * 100)}%`
  return (
    <section className="finance-panel">
      <div className="finance-panel-heading">
        <h3>Evolución mensual</h3>
        <div className="finance-legend" aria-hidden="true">
          <span className="is-income">Ingresos</span>
          <span className="is-expense">Gastos</span>
        </div>
      </div>
      {months.length ? (
        <>
          <div className="finance-chart" aria-hidden="true">
            {ordered.map((row) => (
              <div
                key={row.month}
                className="finance-chart-col"
                title={`${monthLabel(row.month)}\nIngresos ${money(row.incomeNet)}\nGastos ${money(row.expenseNet)}\nBeneficio ${money(row.profit)}`}
              >
                <div className="finance-chart-bars">
                  <i className="is-income" style={{ height: height(row.incomeNet) }} />
                  <i className="is-expense" style={{ height: height(row.expenseNet) }} />
                </div>
                <span>{shortMonth(row.month)}</span>
              </div>
            ))}
          </div>
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="is-number">Ingresos</th>
                  <th className="is-number">Gastos</th>
                  <th className="is-number">Beneficio</th>
                </tr>
              </thead>
              <tbody>
                {months.map((row) => (
                  <tr key={row.month}>
                    <td className="is-capitalized">{monthLabel(row.month)}</td>
                    <td className="is-number">{money(row.incomeNet)}</td>
                    <td className="is-number">{money(row.expenseNet)}</td>
                    <td className={`is-number is-strong ${tone(row.profit)}`}>
                      {money(row.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="finance-empty">
          {loading ? 'Cargando…' : 'No hay movimientos en este periodo.'}
        </p>
      )}
    </section>
  )
}

export function CategoryPanel({ categories }: { categories: CategoryTotal[] }) {
  return (
    <section className="finance-panel">
      <div className="finance-panel-heading">
        <h3>Gastos por categoría</h3>
      </div>
      {categories.length ? (
        <ul className="finance-categories">
          {categories.map((row) => (
            <li key={row.category}>
              <div>
                <span>{expenseCategoryLabel(row.category)}</span>
                <strong>{money(row.netAmount)}</strong>
              </div>
              <div className="finance-meter" aria-hidden="true">
                <i style={{ width: `${row.share}%` }} />
              </div>
              <small>{percent(row.share)} del gasto</small>
            </li>
          ))}
        </ul>
      ) : (
        <div className="finance-empty-state">
          <strong>Sin gastos en este periodo</strong>
          <span>Cuando registres gastos verás aquí cómo se reparten por categoría.</span>
        </div>
      )}
    </section>
  )
}

const INCOME_PREVIEW = 6

export function IncomePanel({ income, loading }: { income: FinanceIncome[]; loading: boolean }) {
  const [showAll, setShowAll] = useState(false)
  const sorted = [...income].sort((a, b) => b.issuedOn.localeCompare(a.issuedOn))
  const visible = showAll ? sorted : sorted.slice(0, INCOME_PREVIEW)
  return (
    <section className="finance-panel">
      <div className="finance-panel-heading">
        <h3>Facturas emitidas</h3>
        {sorted.length > INCOME_PREVIEW && (
          <Button size="sm" variant="ghost" onClick={() => setShowAll((value) => !value)}>
            {showAll ? 'Ver menos' : `Ver las ${sorted.length}`}
          </Button>
        )}
      </div>
      {visible.length ? (
        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Nº factura</th>
                <th>Cliente</th>
                <th className="is-number">Base</th>
                <th className="is-number">Total</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.issuedInvoiceId}>
                  <td>{dateLabel(item.issuedOn)}</td>
                  <td>{item.invoiceNumber}</td>
                  <td>
                    <span className="finance-cell-main">{item.clientName}</span>
                    <span className="finance-cell-sub">{item.concept}</span>
                  </td>
                  <td className="is-number">{money(item.netAmount)}</td>
                  <td className="is-number is-strong">{money(item.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="finance-empty">
          {loading ? 'Cargando…' : 'Aún no hay facturas emitidas en este periodo.'}
        </p>
      )}
    </section>
  )
}
