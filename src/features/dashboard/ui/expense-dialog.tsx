import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@doscientos/ui'
import { Save } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import {
  EXPENSE_DOCUMENT_MAX_BYTES,
  EXPENSE_DOCUMENT_TYPES,
  type Expense,
  type ExpenseCategory,
  type ExpenseInput,
} from '../application/finance'
import { expenseCategoryLabel, expenseCategoryValue } from '../application/finance-summary'
import { ExpenseCategoryField } from './expense-category-field'

export type ExpenseSubmit = {
  input: ExpenseInput
  file: File | null
  removeDocument: boolean
}

const today = () => new Date().toISOString().slice(0, 10)

export function ExpenseDialog({
  expense,
  onClose,
  onSubmit,
}: {
  expense: Expense | null
  onClose: () => void
  onSubmit: (value: ExpenseSubmit) => Promise<void>
}) {
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? today())
  const [vendor, setVendor] = useState(expense?.vendor ?? '')
  const [vendorNif, setVendorNif] = useState(expense?.vendorNif ?? '')
  const [invoiceReference, setInvoiceReference] = useState(expense?.invoiceReference ?? '')
  const [concept, setConcept] = useState(expense?.concept ?? '')
  const [category, setCategory] = useState<ExpenseCategory>(
    expense ? expenseCategoryLabel(expense.category) : expenseCategoryLabel('otros'),
  )
  const [netAmount, setNetAmount] = useState(expense ? String(expense.netAmount) : '')
  const [vatRate, setVatRate] = useState(expense ? String(expense.vatRate) : '21')
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [removeDocument, setRemoveDocument] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const net = Number(netAmount.replace(',', '.'))
  const rate = Number(vatRate.replace(',', '.'))
  const total = Number.isFinite(net) && Number.isFinite(rate) ? net * (1 + rate / 100) : 0

  function validate() {
    if (!vendor.trim()) return 'Indica el proveedor.'
    if (!concept.trim()) return 'Indica el concepto del gasto.'
    if (!category.trim()) return 'Indica la categoría del gasto.'
    if (!netAmount.trim() || !Number.isFinite(net) || net < 0)
      return 'La base imponible no es válida.'
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return 'El IVA debe estar entre 0 y 100.'
    if (file && !EXPENSE_DOCUMENT_TYPES.includes(file.type)) return 'Adjunta un PDF o una imagen.'
    if (file && file.size > EXPENSE_DOCUMENT_MAX_BYTES) return 'El archivo supera los 10 MB.'
    return ''
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit({
        input: {
          expenseDate,
          vendor,
          vendorNif,
          invoiceReference,
          concept,
          category: expenseCategoryValue(category),
          netAmount: Math.round(net * 100) / 100,
          vatRate: rate,
          notes,
        },
        file,
        removeDocument,
      })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido guardar el gasto.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dialog-card">
        <DialogHeader className="gap-0">
          <DialogTitle>{expense ? 'Editar gasto' : 'Nuevo gasto'}</DialogTitle>
          <DialogDescription>
            Registra la factura o ticket de un proveedor para calcular el beneficio.
          </DialogDescription>
        </DialogHeader>
        <form className="expense-form" onSubmit={(event) => void submit(event)}>
          <Label>
            Fecha
            <Input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </Label>
          <ExpenseCategoryField value={category} onChange={setCategory} />
          <Label>
            Proveedor
            <Input value={vendor} maxLength={160} onChange={(e) => setVendor(e.target.value)} />
          </Label>
          <Label>
            NIF/CIF del proveedor
            <Input
              value={vendorNif}
              maxLength={40}
              onChange={(e) => setVendorNif(e.target.value)}
            />
          </Label>
          <Label>
            Nº de factura
            <Input
              value={invoiceReference}
              maxLength={80}
              onChange={(e) => setInvoiceReference(e.target.value)}
            />
          </Label>
          <Label className="expense-form-wide">
            Concepto
            <Input value={concept} maxLength={240} onChange={(e) => setConcept(e.target.value)} />
          </Label>
          <Label>
            Base imponible (€)
            <Input
              inputMode="decimal"
              value={netAmount}
              onChange={(e) => setNetAmount(e.target.value)}
            />
          </Label>
          <Label>
            IVA (%)
            <Input
              inputMode="decimal"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
            />
          </Label>
          <p className="expense-form-total expense-form-wide">
            Total con IVA:{' '}
            <strong>{total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</strong>
          </p>
          <Label className="expense-form-wide">
            Notas
            <Textarea
              value={notes}
              maxLength={1000}
              rows={2}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Label>
          <Label className="expense-form-wide">
            Justificante (PDF o imagen, máx. 10 MB)
            <Input
              type="file"
              accept={EXPENSE_DOCUMENT_TYPES.join(',')}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Label>
          {expense?.documentName && !file && (
            <label className="expense-form-wide expense-form-check">
              <input
                type="checkbox"
                checked={removeDocument}
                onChange={(e) => setRemoveDocument(e.target.checked)}
              />
              Quitar el justificante actual ({expense.documentName})
            </label>
          )}
          {error && (
            <p className="form-error expense-form-wide" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="dialog-submit expense-form-wide" disabled={saving}>
            <Save /> {saving ? 'Guardando…' : 'Guardar gasto'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
