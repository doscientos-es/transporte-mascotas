import { Button } from '@doscientos/ui'
import { CalendarPlus, CheckCircle2, Download, FileText, PawPrint, RefreshCw } from 'lucide-react'
import { useState } from 'react'

import type { TransportRequest } from '@/shared/types'

import { formatDate } from '../application/route-maps'
import {
  googleCalendarUrl,
  isConfirmedTransport,
  transportCalendarIcs,
} from '../application/transport-calendar'
import { saveFile } from './save-file'

type Props = {
  request?: TransportRequest
  confirming: boolean
  formatCurrency: (cents: number) => string
  onDownloadInvoice: (requestId: string) => Promise<void>
  onClose: () => void
}

export function PaymentSuccessPanel({
  request,
  confirming,
  formatCurrency,
  onDownloadInvoice,
  onClose,
}: Props) {
  const [downloading, setDownloading] = useState(false)
  const [invoiceError, setInvoiceError] = useState('')
  const confirmed = request ? isConfirmedTransport(request.status) : false

  async function downloadInvoice() {
    if (!request || downloading) return
    setDownloading(true)
    setInvoiceError('')
    try {
      await onDownloadInvoice(request.id)
    } catch (reason) {
      setInvoiceError(reason instanceof Error ? reason.message : 'No se ha podido descargar.')
    } finally {
      setDownloading(false)
    }
  }

  function downloadCalendar() {
    if (!request) return
    saveFile(
      new Blob([transportCalendarIcs(request)], { type: 'text/calendar;charset=utf-8' }),
      `transporte-${request.desiredDate}.ics`,
    )
  }

  return (
    <section className="payment-success" aria-live="polite">
      <div className="payment-success-hero">
        <CheckCircle2 size={44} aria-hidden="true" />
        <h2>¡Pago completado! Muchas gracias</h2>
        <p>
          {request
            ? `Hemos recibido tu pago de ${formatCurrency(request.amountCents)}. Te enviaremos la confirmación a ${request.contactEmail}.`
            : 'Hemos recibido tu pago. Estamos cargando los datos de tu transporte.'}
        </p>
      </div>

      {request && (
        <div className="payment-success-summary">
          <div>
            <span>Trayecto</span>
            <strong>
              {request.origin} → {request.destination}
            </strong>
          </div>
          <div>
            <span>Fecha</span>
            <strong>{formatDate(request.desiredDate)}</strong>
          </div>
          <div>
            <span>Mascotas</span>
            <strong>
              <PawPrint size={14} aria-hidden="true" />{' '}
              {request.animals.map((animal) => animal.name?.trim() || animal.species).join(', ')}
            </strong>
          </div>
          <div>
            <span>Estado</span>
            <strong className={confirmed ? 'is-confirmed' : ''}>
              {confirmed ? (
                'Transporte confirmado'
              ) : (
                <>
                  <RefreshCw className={confirming ? 'is-spinning' : ''} size={14} />{' '}
                  {confirming ? 'Confirmando tu reserva…' : 'Pago registrado, en revisión'}
                </>
              )}
            </strong>
          </div>
        </div>
      )}

      {request && (
        <div className="payment-success-actions">
          <Button type="button" disabled={!confirmed || downloading} onClick={() => void downloadInvoice()}>
            {downloading ? <RefreshCw className="is-spinning" size={16} /> : <FileText size={16} />}
            {downloading ? 'Descargando…' : 'Descargar factura'}
          </Button>
          <a
            className="payment-success-link"
            href={googleCalendarUrl(request)}
            target="_blank"
            rel="noreferrer"
          >
            <CalendarPlus size={16} /> Añadir a Google Calendar
          </a>
          <Button type="button" variant="outline" onClick={downloadCalendar}>
            <Download size={16} /> Apple / Outlook (.ics)
          </Button>
        </div>
      )}
      {request && !confirmed && (
        <p className="payment-success-hint">
          La factura estará disponible en cuanto confirmemos la reserva. También podrás descargarla
          desde Mis transportes.
        </p>
      )}
      {invoiceError && (
        <p className="payment-success-hint is-error" role="alert">
          {invoiceError}
        </p>
      )}

      <ul className="payment-success-steps">
        <li>Te avisaremos con la hora aproximada de recogida antes del viaje.</li>
        <li>Ten a mano la documentación y la cartilla de tu mascota.</li>
        <li>Puedes seguir el estado del transporte en todo momento desde Mis transportes.</li>
      </ul>

      <Button type="button" variant="ghost" onClick={onClose}>
        Ver mis transportes
      </Button>
    </section>
  )
}
