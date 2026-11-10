import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@doscientos/ui'
import { useRef, useState } from 'react'

import type { InvoiceClientInput, ManualInvoiceInput, ManualPaymentMethod } from '@/shared/types'

import { invoiceClientFromSaved } from '../application/client-values'
import { createPaidManualInvoice } from '../application/manual-invoices'
import { invoiceAmounts } from '../domain/invoice-values'
import { ClientFields } from './client-fields'
import { ClientLookup } from './client-lookup'

const currency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)

export function ManualInvoiceDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (result: { invoiceDraftId: string; documentPending: boolean }) => void
}) {
  // Reuse this identity after a lost response: retrying must not consume another number.
  const [id] = useState(() => crypto.randomUUID())
  const [client, setClient] = useState<InvoiceClientInput>({
    fullName: '',
    nif: '',
    address: '',
    postalCode: '',
    city: '',
    email: '',
    phone: '',
  })
  const [concept, setConcept] = useState('')
  const [total, setTotal] = useState('')
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date())
  const [operationDate, setOperationDate] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>('Transferencia')
  const [saving, setSaving] = useState(false)
  const submitting = useRef(false)
  const [error, setError] = useState('')
  let amounts: ReturnType<typeof invoiceAmounts> | undefined
  try {
    amounts = invoiceAmounts(Number(total))
  } catch {
    /* Show totals once the amount is valid. */
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      const input: ManualInvoiceInput = {
        id,
        client,
        concept,
        total: Number(total),
        operationDate,
        paymentMethod,
      }
      const result = await createPaidManualInvoice(input)
      onCreated(result)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido crear la factura.')
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting.current) onClose()
      }}
    >
      <DialogContent className="dialog-card max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva factura libre</DialogTitle>
          <DialogDescription>
            Para extras o servicios sin carta de porte. Se emitirá como pagada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)}>
          <fieldset disabled={saving} className="client-form min-w-0 border-0 p-0">
            <div className="form-span">
              <ClientLookup
                label="Buscar cliente existente (opcional)"
                onSelect={(item) => setClient(invoiceClientFromSaved(item))}
              />
            </div>
            <ClientFields
              value={client}
              requireFiscal
              onChange={(field, value) => setClient((current) => ({ ...current, [field]: value }))}
            />
            <Label className="form-span">
              Concepto
              <Input
                value={concept}
                onChange={(event) => setConcept(event.target.value)}
                required
                maxLength={500}
                placeholder="Ej. servicio adicional de cuidado"
              />
            </Label>
            <Label>
              Fecha de operación
              <Input
                type="date"
                value={operationDate}
                max={today}
                onChange={(event) => setOperationDate(event.target.value)}
                required
              />
            </Label>
            <Label>
              Total con IVA (21 %) incluido
              <Input
                type="number"
                inputMode="decimal"
                min="0.01"
                max="999999.99"
                step="0.01"
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                required
              />
            </Label>
            {amounts && (
              <output className="form-span">
                Base: {currency(amounts.netAmount)} · IVA: {currency(amounts.vatAmount)} · Total:{' '}
                {currency(amounts.totalAmount)}
              </output>
            )}
            <label className="date-field form-span">
              Método de cobro
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as ManualPaymentMethod)}
              >
                <option>Transferencia</option>
                <option>Bizum</option>
                <option>Tarjeta</option>
              </select>
            </label>
            <p className="form-span">
              Al confirmar se registrará el cobro y se asignará el número definitivo. La factura
              actualiza el cobro registrado si se modifica su importe.
            </p>
            {error && (
              <p className="form-error form-span" role="alert">
                {error}
              </p>
            )}
            <div className="form-span flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">{saving ? 'Emitiendo…' : 'Crear y marcar pagada'}</Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
