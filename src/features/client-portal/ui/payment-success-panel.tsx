import { Button } from '@doscientos/ui'
import {
  CalendarPlus,
  CheckCircle2,
  Download,
  FileDown,
  FileText,
  MapPin,
  PawPrint,
  RefreshCw,
} from 'lucide-react'
import { useState } from 'react'

import type { TransportRequest } from '@/shared/types'

import { formatDate, transportLocationMapsUrl } from '../application/route-maps'
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
  onDownloadCarriageLetter: (requestId: string) => Promise<void>
  onClose: () => void
}

type DocumentKind = 'invoice' | 'letter'

export function PaymentSuccessPanel({
  request,
  confirming,
  formatCurrency,
  onDownloadInvoice,
  onDownloadCarriageLetter,
  onClose,
}: Props) {
  const [downloading, setDownloading] = useState<DocumentKind | null>(null)
  const [invoiceError, setInvoiceError] = useState('')
  const confirmed = request ? isConfirmedTransport(request.status) : false
  const paymentRecorded = Boolean(
    request?.paidAt ||
    request?.status === 'por_verificar' ||
    (request && isConfirmedTransport(request.status)),
  )

  async function downloadDocument(kind: DocumentKind) {
    if (!request || downloading) return
    setDownloading(kind)
    setInvoiceError('')
    try {
      await (kind === 'invoice' ? onDownloadInvoice : onDownloadCarriageLetter)(request.id)
    } catch (reason) {
      setInvoiceError(reason instanceof Error ? reason.message : 'No se ha podido descargar.')
    } finally {
      setDownloading(null)
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
        {paymentRecorded || confirmed ? (
          <CheckCircle2 size={44} aria-hidden="true" />
        ) : (
          <RefreshCw size={44} aria-hidden="true" />
        )}
        <h2>
          {confirmed
            ? '¡Transporte confirmado!'
            : paymentRecorded
              ? 'Pago recibido; estamos revisando la solicitud'
              : confirming
                ? 'Estamos comprobando el pago con CaixaBank'
                : 'Aún no hemos podido confirmar el pago'}
        </h2>
        <p>
          {paymentRecorded && request
            ? `El pago de ${formatCurrency(request.amountCents)} está registrado. No necesitas volver a pagar; te avisaremos cuando terminemos de confirmar el transporte.`
            : confirming
              ? 'CaixaBank nos ha devuelto a la aplicación y estamos contrastando la confirmación. No vuelvas a pagar mientras comprobamos el resultado.'
              : 'No hemos recibido una confirmación final del banco. No vuelvas a iniciar el pago; contacta con Kache Envíos para que revisemos la operación.'}
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
              ) : paymentRecorded ? (
                'Pago registrado; solicitud en revisión'
              ) : (
                <>
                  <RefreshCw className={confirming ? 'is-spinning' : ''} size={14} />{' '}
                  {confirming ? 'Verificando con CaixaBank…' : 'Pendiente de conciliación'}
                </>
              )}
            </strong>
          </div>
        </div>
      )}

      {request && (
        <div className="payment-success-actions">
          <Button
            type="button"
            disabled={!confirmed || Boolean(downloading)}
            onClick={() => void downloadDocument('invoice')}
          >
            {downloading === 'invoice' ? (
              <RefreshCw className="is-spinning" size={16} />
            ) : (
              <FileText size={16} />
            )}
            {downloading === 'invoice' ? 'Descargando…' : 'Descargar factura'}
          </Button>
          <Button
            type="button"
            disabled={!confirmed || Boolean(downloading)}
            onClick={() => void downloadDocument('letter')}
          >
            {downloading === 'letter' ? (
              <RefreshCw className="is-spinning" size={16} />
            ) : (
              <FileDown size={16} />
            )}
            {downloading === 'letter' ? 'Descargando…' : 'Descargar carta de porte'}
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
          <a
            className="payment-success-link"
            href={transportLocationMapsUrl(
              request.origin,
              request.originLatitude,
              request.originLongitude,
            )}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={16} /> Recogida · {request.origin}
          </a>
          <a
            className="payment-success-link"
            href={transportLocationMapsUrl(
              request.destination,
              request.destinationLatitude,
              request.destinationLongitude,
            )}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={16} /> Entrega · {request.destination}
          </a>
        </div>
      )}
      {request && !confirmed && (
        <p className="payment-success-hint">
          La factura y la carta de porte estarán disponibles en cuanto confirmemos la reserva.
          También podrás descargarlas desde Mis transportes.
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
