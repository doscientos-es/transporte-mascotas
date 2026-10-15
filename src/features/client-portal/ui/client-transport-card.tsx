import { Button } from '@doscientos/ui'
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileDown,
  FileText,
  MapPin,
  Navigation,
  PawPrint,
} from 'lucide-react'

import { transportBoxCategoryLabel } from '@/shared/application/transport-boxes'
import type { TransportRequest, UpcomingRoute } from '@/shared/types'
import { StatusBadge } from '@/shared/ui/status-badge'

import {
  canRetryTransportPayment,
  transportPaymentAttemptNotice,
} from '../application/payment-attempt'
import { formatDate, mapsEmbedUrl, transportLocationMapsUrl } from '../application/route-maps'
import {
  displayTransportStatus,
  isConfirmedTransport,
  pickupMoment,
} from '../application/transport-calendar'

type Props = {
  request: TransportRequest
  route?: Pick<UpcomingRoute, 'serviceDate' | 'startTime' | 'endDate' | 'stops'>
  formatCurrency: (cents: number) => string
  payingRequestId: string | null
  downloadingInvoiceId: string | null
  downloadingLetterId: string | null
  onContinuePayment: (requestId: string) => void
  onDownloadInvoice: (requestId: string) => void
  onDownloadCarriageLetter: (requestId: string) => void
}

export function ClientTransportCard({
  request: storedRequest,
  route,
  formatCurrency,
  payingRequestId,
  downloadingInvoiceId,
  downloadingLetterId,
  onContinuePayment,
  onDownloadInvoice,
  onDownloadCarriageLetter,
}: Props) {
  const request = {
    ...storedRequest,
    status: displayTransportStatus(storedRequest, new Date(), route),
  }
  const confirmed = isConfirmedTransport(request.status)
  const pickup = pickupMoment(storedRequest, route)
  const needsAttention = ['pago_pendiente', 'por_verificar', 'rechazada', 'cancelada'].includes(
    request.status,
  )
  const hint =
    request.status === 'pago_pendiente'
      ? clientStatusHint(request.status, request.paymentAttemptStatus)
      : request.adminNote || (needsAttention ? clientStatusHint(request.status) : '')

  return (
    <article className="ctr" data-status={request.status}>
      <header className="ctr-head">
        <div className="ctr-title">
          <h3>
            <span>{request.origin}</span>
            <ArrowRight size={16} aria-hidden="true" />
            <span>{request.destination}</span>
          </h3>
          {hint && <p>{hint}</p>}
        </div>
        <StatusBadge status={request.status} />
      </header>

      <dl className="ctr-facts">
        <div>
          <dt>Recogida</dt>
          <dd className="ctr-pickup">
            <time dateTime={pickup.time ? `${pickup.date}T${pickup.time}` : pickup.date}>
              {formatDate(pickup.date)}
            </time>
            {pickup.time && <small>{pickup.time} h</small>}
          </dd>
        </div>
        <div>
          <dt>{request.animals.length === 1 ? 'Mascota' : 'Mascotas'}</dt>
          <dd>
            {request.animals.map((animal) => (
              <span className="ctr-pet" key={animal.id || `${request.id}-${animal.ordinal}`}>
                <PawPrint size={13} aria-hidden="true" />
                {animal.name.trim() || animal.species}
                <small>
                  {transportBoxCategoryLabel(
                    animal.assignedBoxCategory ??
                      animal.requestedBoxCategory ??
                      animal.minimumBoxCategory ??
                      'pequeno',
                  )}
                </small>
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt>Importe</dt>
          <dd>
            <strong>{formatCurrency(request.amountCents)}</strong>
            {request.paidAt && (
              <span className="ctr-paid">
                <CheckCircle2 size={13} aria-hidden="true" /> Pago registrado
              </span>
            )}
          </dd>
        </div>
      </dl>

      {request.status === 'pago_pendiente' &&
        canRetryTransportPayment(request.paymentAttemptStatus) && (
          <div className="ctr-actions">
            <Button
              size="sm"
              disabled={Boolean(payingRequestId)}
              onClick={() => onContinuePayment(request.id)}
            >
              <CreditCard size={15} />{' '}
              {payingRequestId === request.id
                ? 'Abriendo pago…'
                : `Continuar pago · ${formatCurrency(request.amountCents)}`}
            </Button>
          </div>
        )}

      <div className="ctr-links">
        {confirmed && (
          <>
            <button
              type="button"
              disabled={Boolean(downloadingInvoiceId)}
              onClick={() => onDownloadInvoice(request.id)}
            >
              <FileText size={14} aria-hidden="true" />
              {downloadingInvoiceId === request.id ? 'Descargando…' : 'Descargar factura'}
            </button>
            <button
              type="button"
              disabled={Boolean(downloadingLetterId)}
              onClick={() => onDownloadCarriageLetter(request.id)}
            >
              <FileDown size={14} aria-hidden="true" />
              {downloadingLetterId === request.id ? 'Descargando…' : 'Descargar carta de porte'}
            </button>
          </>
        )}
      </div>

      <details className="ctr-details">
        <summary>
          <MapPin size={14} aria-hidden="true" /> Ver recogida y entrega
        </summary>
        <div className="client-transport-locations">
          <TransportLocationMap
            label="Recogida"
            location={request.origin}
            latitude={request.originLatitude}
            longitude={request.originLongitude}
          />
          <TransportLocationMap
            label="Entrega"
            location={request.destination}
            latitude={request.destinationLatitude}
            longitude={request.destinationLongitude}
          />
        </div>
      </details>
    </article>
  )
}

function TransportLocationMap({
  label,
  location,
  latitude,
  longitude,
}: {
  label: string
  location: string
  latitude?: number
  longitude?: number
}) {
  return (
    <section className="client-transport-location" aria-label={`${label}: ${location}`}>
      <div className="client-transport-location-heading">
        <span>
          <MapPin size={14} aria-hidden="true" /> {label}
        </span>
        <strong>{location}</strong>
      </div>
      {typeof latitude === 'number' && typeof longitude === 'number' && (
        <iframe
          className="client-transport-location-map"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={mapsEmbedUrl(latitude, longitude)}
          title={`Mapa de ${label.toLocaleLowerCase()} en ${location}`}
        />
      )}
      <a
        className="client-transport-location-link"
        href={transportLocationMapsUrl(location, latitude, longitude)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Cómo llegar a ${label.toLocaleLowerCase()} en ${location}`}
      >
        <Navigation size={14} aria-hidden="true" /> Abrir indicaciones
      </a>
    </section>
  )
}

function clientStatusHint(
  status: TransportRequest['status'],
  paymentAttemptStatus?: TransportRequest['paymentAttemptStatus'],
) {
  if (status === 'pago_pendiente')
    return (
      (paymentAttemptStatus ? transportPaymentAttemptNotice(paymentAttemptStatus) : undefined) ??
      'Estamos esperando la confirmación del pago.'
    )
  if (status === 'por_verificar') return 'Pago recibido. Estamos confirmando tu reserva.'
  if (status === 'confirmada')
    return 'Tu transporte está confirmado. Te avisaremos con los detalles.'
  if (status === 'en_ruta') return 'El transporte ya está en ruta.'
  if (status === 'entregada') return 'El transporte se ha completado.'
  if (status === 'rechazada')
    return 'No hemos podido asignar esta solicitud. Puedes contactar con nosotros para revisarla.'
  if (status === 'cancelada') return 'Esta solicitud está cancelada. Si tienes dudas, contáctanos.'
  return ''
}
