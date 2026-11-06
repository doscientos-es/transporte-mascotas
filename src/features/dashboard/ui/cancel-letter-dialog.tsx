import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@doscientos/ui'
import { useState } from 'react'

export function CancelLetterDialog({
  letterId,
  onCancelLetter,
  onClose,
}: {
  letterId: string
  onCancelLetter: (letterId: string) => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onCancelLetter(letterId)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido anular la carta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <AlertDialogContent className="!w-[calc(100%-2.5rem)] !max-w-[460px] !p-[26px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Anular carta de porte</AlertDialogTitle>
          <AlertDialogDescription>
            Se retirará {letterId} de todas sus rutas y se liberarán sus boxes. Se conservan la
            carta, el cliente y la factura. No se harán devoluciones ni se desactivarán enlaces de
            pago.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Volver</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={(event) => {
              event.preventDefault()
              void confirm()
            }}
          >
            {busy ? 'Anulando…' : 'Anular carta'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
