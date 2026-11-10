import { Button, Input, Label } from '@doscientos/ui'
import { Building2, Plus } from 'lucide-react'
import { useEffect, useState, type Dispatch } from 'react'

import {
  loadExpenseSupplierPage,
  searchExpenseSuppliers,
  type ExpenseSupplier,
  type SupplierSelection,
  type SupplierSelectionAction,
} from '../application/expense-suppliers'

export function ExpenseSupplierField({
  selection,
  dispatch,
}: {
  selection: SupplierSelection
  dispatch: Dispatch<SupplierSelectionAction>
}) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ExpenseSupplier[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [hasMore, setHasMore] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const { mode, fields } = selection

  useEffect(() => {
    if (mode !== 'lookup') return
    let active = true
    setStatus('loading')
    setItems([])
    const timeout = window.setTimeout(
      () => {
        const request = query.trim()
          ? searchExpenseSuppliers(query).then((matches) => ({
              items: matches,
              hasMore: matches.length === 10,
            }))
          : loadExpenseSupplierPage(1, '').then((page) => ({
              items: page.items,
              hasMore: page.total > page.items.length,
            }))
        void request
          .then((result) => {
            if (!active) return
            setItems(result.items)
            setHasMore(result.hasMore)
            setStatus('ready')
          })
          .catch(() => {
            if (active) setStatus('failed')
          })
      },
      query.trim() ? 250 : 0,
    )
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [mode, query, retryKey])

  const manual = mode === 'new' || mode === 'edit'
  return (
    <fieldset className="expense-form-wide grid min-w-0 gap-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">¿Quién es el proveedor?</legend>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === 'new' ? 'outline' : 'default'}
          aria-pressed={mode !== 'new'}
          onClick={() => {
            if (mode === 'new') {
              setQuery('')
              dispatch({ type: 'lookup' })
            }
          }}
        >
          <Building2 size={16} /> Proveedor guardado
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'new' ? 'default' : 'outline'}
          aria-pressed={mode === 'new'}
          onClick={() => {
            if (mode !== 'new') dispatch({ type: 'new' })
          }}
        >
          <Plus size={16} /> Proveedor nuevo
        </Button>
      </div>
      {mode === 'lookup' && (
        <div className="grid gap-2">
          <Label>
            Buscar por nombre o NIF/CIF
            <Input
              type="search"
              value={query}
              placeholder="Ej. Taller o B12345678"
              onChange={(event) => setQuery(event.target.value)}
            />
          </Label>
          {status === 'loading' ? (
            <output className="text-muted-foreground m-0 text-sm">Cargando proveedores…</output>
          ) : status === 'failed' ? (
            <div className="grid gap-2">
              <p role="alert" className="m-0 text-sm">
                No se han podido cargar los proveedores. Puedes introducir uno nuevo.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                onClick={() => setRetryKey((value) => value + 1)}
              >
                Reintentar
              </Button>
            </div>
          ) : items.length ? (
            <>
              <Label>
                Selecciona un proveedor
                <select
                  className="bg-background w-full rounded-md border px-3 py-2 text-sm"
                  value=""
                  onChange={(event) => {
                    const supplier = items.find((item) => item.id === event.target.value)
                    if (supplier) dispatch({ type: 'select', supplier })
                  }}
                >
                  <option value="">Selecciona un proveedor</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {[item.name, item.nif].filter(Boolean).join(' · ')}
                    </option>
                  ))}
                </select>
              </Label>
              {hasMore && (
                <p className="text-muted-foreground m-0 text-xs">
                  Escribe más caracteres para acotar la búsqueda.
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground m-0 text-sm">
              {query.trim()
                ? 'No hay proveedores que coincidan.'
                : 'Todavía no hay proveedores guardados.'}{' '}
              Puedes añadir uno nuevo.
            </p>
          )}
        </div>
      )}
      {mode === 'selected' && (
        <div className="bg-muted/50 grid gap-2 rounded-md p-3 text-sm">
          <strong>{fields.vendor}</strong>
          <span>NIF/CIF: {fields.vendorNif || 'No indicado'}</span>
          <span>Dirección fiscal: {fields.vendorAddress || 'No indicada'}</span>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setQuery('')
                dispatch({ type: 'lookup' })
              }}
            >
              Cambiar proveedor
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => dispatch({ type: 'edit' })}
            >
              Editar datos
            </Button>
          </div>
        </div>
      )}
      {manual && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Label>
            Proveedor
            <Input
              value={fields.vendor}
              maxLength={160}
              aria-required="true"
              placeholder="Ej. Taller de vehículos"
              onChange={(event) =>
                dispatch({ type: 'update', fields: { ...fields, vendor: event.target.value } })
              }
            />
          </Label>
          <Label>
            NIF/CIF del proveedor
            <Input
              value={fields.vendorNif}
              maxLength={40}
              placeholder="Ej. B12345678"
              onChange={(event) =>
                dispatch({ type: 'update', fields: { ...fields, vendorNif: event.target.value } })
              }
            />
          </Label>
          <Label className="sm:col-span-2">
            Dirección fiscal del proveedor
            <Input
              value={fields.vendorAddress}
              maxLength={300}
              autoComplete="off"
              placeholder="Ej. Calle Mayor 10, 28001 Madrid"
              onChange={(event) =>
                dispatch({
                  type: 'update',
                  fields: { ...fields, vendorAddress: event.target.value },
                })
              }
            />
          </Label>
          <p className="text-muted-foreground m-0 text-xs sm:col-span-2">
            Al guardar el gasto, se guarda o actualiza el proveedor.
          </p>
          {mode === 'edit' && (
            <div className="sm:col-span-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => dispatch({ type: 'finish-edit' })}
              >
                Terminar edición
              </Button>
            </div>
          )}
        </div>
      )}
    </fieldset>
  )
}
