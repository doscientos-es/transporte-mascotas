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

import type { InvoiceClientInput, IssuedInvoice } from '@/shared/types'

import { editInvoice } from '../application/edit-invoice'
import { invoiceAmounts } from '../domain/invoice-values'
import { ClientFields } from './client-fields'

const currency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)

export function EditInvoiceDialog({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: IssuedInvoice
  onClose: () => void
  onSaved: () => void
}) {
  const snapshot = invoice.fiscalSnapshot
  const [client, setClient] = useState<InvoiceClientInput>({
    fullName: snapshot.client?.fullName ?? '',
    nif: snapshot.client?.nif ?? '',
    address: snapshot.client?.address ?? '',
    postalCode: snapshot.client?.postalCode ?? '',
    city: snapshot.client?.city ?? '',
    email: snapshot.client?.email ?? '',
    phone: snapshot.client?.phone ?? '',
  })
  const [concept, setConcept] = useState(snapshot.concept ?? '')
  const [total, setTotal] = useState(String(snapshot.total_amount ?? ''))
  const [operationDate, setOperationDate] = useState(
    snapshot.operation_date?.slice(0, 10) ?? invoice.issuedAt.slice(0, 10),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const vatRate = Number(snapshot.vat_rate ?? NaN)
  let amounts: ReturnType<typeof invoiceAmounts> | undefined
  try {
    amounts = invoiceAmounts(Number(total), vatRate)
  } catch {
    // The amount preview is shown only for valid values.
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      await editInvoice(invoice, client, concept, operationDate, Number(total))
      onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido guardar la factura.')
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
          <DialogTitle>Editar factura {invoice.number}</DialogTitle>
          <DialogDescription>
            Se conservará la versión anterior y se generará un nuevo PDF. El número no cambia y el
            PDF actualizado no se envía automáticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)}>
          <fieldset disabled={saving} className="client-form min-w-0 border-0 p-0">
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
              />
            </Label>
            <Label>
              Fecha de operación
              <Input
                type="date"
                value={operationDate}
                onChange={(event) => setOperationDate(event.target.value)}
                required
              />
            </Label>
            <Label>
              Total con IVA ({vatRate} %) incluido
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
            <p className="form-span">
              Si cambias el total, también se actualizará el cobro registrado en la aplicación. No se
              hará ningún cobro ni devolución en el banco.
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
              <Button type="submit">{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
