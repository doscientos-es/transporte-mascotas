import { Button, Pagination } from '@doscientos/ui'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  EXPENSE_SUPPLIER_PAGE_SIZE,
  loadExpenseSupplierPage,
  type ExpenseSupplier,
} from '../application/expense-suppliers'

export function ExpenseSuppliersPanel({
  onNewExpense,
  refreshKey,
}: {
  onNewExpense: (supplier: ExpenseSupplier) => void
  refreshKey: number
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<{ items: ExpenseSupplier[]; total: number }>({
    items: [],
    total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    const timeout = window.setTimeout(
      () => {
        void loadExpenseSupplierPage(page, query)
          .then((next) => {
            if (active) setResult(next)
          })
          .catch(() => {
            if (active) setError(true)
          })
          .finally(() => {
            if (active) setLoading(false)
          })
      },
      query ? 250 : 0,
    )
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [page, query, refreshKey, retryKey])

  const pageCount = Math.max(1, Math.ceil(result.total / EXPENSE_SUPPLIER_PAGE_SIZE))
  useEffect(() => {
    if (!loading && !error && page > pageCount) setPage(pageCount)
  }, [error, loading, page, pageCount])

  return (
    <section className="finance-panel" aria-label="Directorio de proveedores">
      <div className="finance-panel-heading">
        <h3>Proveedores</h3>
      </div>
      <p className="text-muted-foreground text-sm">
        Se guardan al registrar gastos y no dependen del periodo seleccionado.
      </p>
      <div className="finance-filters">
        <label className="finance-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar proveedores por nombre"
            placeholder="Buscar por nombre"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
        </label>
      </div>
      {loading ? (
        <p className="finance-empty">Cargando proveedores…</p>
      ) : error ? (
        <div className="finance-empty-state" role="alert">
          <strong>No se ha podido cargar el directorio de proveedores.</strong>
          <span>Comprueba que la actualización de proveedores esté aplicada.</span>
          <Button size="sm" variant="outline" onClick={() => setRetryKey((value) => value + 1)}>
            Reintentar
          </Button>
        </div>
      ) : result.items.length ? (
        <>
          <ExpenseSupplierTable suppliers={result.items} onNewExpense={onNewExpense} />
          <Pagination
            page={page}
            pageCount={pageCount}
            ariaLabel="Paginación de proveedores"
            onPageChange={setPage}
            summary={`Mostrando ${(page - 1) * EXPENSE_SUPPLIER_PAGE_SIZE + 1}–${Math.min(page * EXPENSE_SUPPLIER_PAGE_SIZE, result.total)} de ${result.total} proveedores`}
          />
        </>
      ) : (
        <p className="finance-empty">
          {query ? 'No hay proveedores con ese nombre.' : 'Todavía no hay proveedores guardados.'}
        </p>
      )}
    </section>
  )
}

export function ExpenseSupplierTable({
  suppliers,
  onNewExpense,
}: {
  suppliers: ExpenseSupplier[]
  onNewExpense: (supplier: ExpenseSupplier) => void
}) {
  return (
    <div className="finance-table-wrap">
      <table className="finance-table">
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>NIF/CIF</th>
            <th>Dirección fiscal</th>
            <th>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td>{supplier.name}</td>
              <td>{supplier.nif || '—'}</td>
              <td>{supplier.address || '—'}</td>
              <td>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`Nuevo gasto para ${supplier.name}`}
                  onClick={() => onNewExpense(supplier)}
                >
                  Nuevo gasto
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
