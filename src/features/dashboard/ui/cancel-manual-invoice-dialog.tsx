import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@doscientos/ui'
import { useState } from 'react'

import type { ClientInvoice } from '@/shared/types'

import { cancelManualInvoice } from '../application/manual-invoices'

export function CancelManualInvoiceDialog({
  invoice,
  onClose,
  onCancelled,
}: {
  invoice: ClientInvoice
  onClose: () => void
  onCancelled: () => void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!invoice.issuedInvoice || saving) return
    setSaving(true)
    setError('')
    try {
      await cancelManualInvoice(invoice.issuedInvoice, reason)
      onCancelled()
    } catch (cause) {
      setError(
        cause &&
          typeof cause === 'object' &&
          'message' in cause &&
          typeof cause.message === 'string'
          ? cause.message
          : 'No se ha podido anular la factura.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="dialog-card">
        <DialogHeader>
          <DialogTitle>Anular factura internamente</DialogTitle>
          <DialogDescription>
            La factura {invoice.issuedInvoice?.number} dejará de contar como ingreso. La factura y
            el cobro se conservarán. No se devuelve dinero ni se genera una rectificativa; el IVA de
            la factura sigue incluido en el resumen fiscal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)}>
          <label className="block">
            Motivo de la anulación
            <textarea
              className="mt-2 w-full rounded-md border p-2"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={3}
              maxLength={500}
              required
              disabled={saving}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Volver
            </Button>
            <Button type="submit" disabled={saving || reason.trim().length < 3}>
              {saving ? 'Anulando…' : 'Anular internamente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
