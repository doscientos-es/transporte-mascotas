import { Button, Card, CardContent } from '@doscientos/ui'
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
import type { TransportRequest } from '@/shared/types'
import { StatusBadge } from '@/shared/ui/status-badge'

import {
  canRetryTransportPayment,
  transportPaymentAttemptNotice,
} from '../application/payment-attempt'
import { formatDate, mapsEmbedUrl, transportLocationMapsUrl } from '../application/route-maps'
import { isConfirmedTransport } from '../application/transport-calendar'

type Props = {
  request: TransportRequest
  formatCurrency: (cents: number) => string
  payingRequestId: string | null
  downloadingInvoiceId: string | null
  downloadingLetterId: string | null
  onContinuePayment: (requestId: string) => void
  onDownloadInvoice: (requestId: string) => void
  onDownloadCarriageLetter: (requestId: string) => void
}

export function ClientTransportCard({
  request,
  formatCurrency,
  payingRequestId,
  downloadingInvoiceId,
  downloadingLetterId,
  onContinuePayment,
  onDownloadInvoice,
  onDownloadCarriageLetter,
}: Props) {
  const confirmed = isConfirmedTransport(request.status)

  return (
    <Card
      className={`invoice-card client-transport-card client-transport-request-card ${request.status === 'por_verificar'
        ? '!border-l-[#ca8a04]'
        : request.status === 'confirmada' || request.status === 'en_ruta'
          ? '!border-l-[#171717]'
          : ''
        }`}
    >
      <CardContent>
        <div className="client-transport-request-header">
          <div className="client-transport-request-overview">
            <div className="invoice-icon client-transport-request-icon">
              <PawPrint size={19} aria-hidden="true" />
            </div>
            <div className="client-transport-request-copy">
              <div className="client-transport-request-meta">
                <span>
                  {request.animals.length} mascota{request.animals.length === 1 ? '' : 's'}
                </span>
                <span aria-hidden="true">·</span>
                <time dateTime={request.desiredDate}>{formatDate(request.desiredDate)}</time>
              </div>
              <h3 className="client-transport-request-route">
                <span>{request.origin}</span>
                <ArrowRight size={17} aria-hidden="true" />
                <span>{request.destination}</span>
              </h3>
              <p className="client-transport-request-note">
                {request.status === 'pago_pendiente'
                  ? clientStatusHint(request.status, request.paymentAttemptStatus)
                  : request.adminNote ||
                    clientStatusHint(request.status, request.paymentAttemptStatus)}
              </p>
              {request.animals.length > 0 && (
                <div className="client-transport-pets">
                  {request.animals.map((animal) => (
                    <span key={animal.id || `${request.id}-${animal.ordinal}`}>
                      <PawPrint size={13} aria-hidden="true" />
                      {animal.name.trim() || animal.species}
                      <span aria-hidden="true">·</span>
                      {transportBoxCategoryLabel(
                        animal.assignedBoxCategory ??
                        animal.requestedBoxCategory ??
                        animal.minimumBoxCategory ??
                        'pequeno',
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="client-transport-request-summary">
            <strong className="client-transport-request-price">
              {formatCurrency(request.amountCents)}
            </strong>
            <StatusBadge status={request.status} className="client-transport-request-status" />
            {request.paidAt && (
              <span className="client-transport-payment-state">
                <CheckCircle2 size={14} aria-hidden="true" /> Pago registrado
              </span>
            )}
            {request.status === 'pago_pendiente' &&
              canRetryTransportPayment(request.paymentAttemptStatus) && (
                <Button
                  className="client-transport-pay-button"
                  size="sm"
                  disabled={Boolean(payingRequestId)}
                  onClick={() => onContinuePayment(request.id)}
                >
                  <CreditCard size={15} />{' '}
                  {payingRequestId === request.id ? 'Abriendo pago…' : 'Continuar pago'}
                </Button>
              )}
          </div>
        </div>

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

        {(request.paidAt || confirmed) && (
          <div className="client-transport-documents">
            {!confirmed && (
              <p>La factura y la carta de porte estarán disponibles cuando confirmemos el pago.</p>
            )}
            <div className="client-transport-document-actions">
              <Button
                size="sm"
                variant="outline"
                disabled={!confirmed || Boolean(downloadingInvoiceId)}
                onClick={() => onDownloadInvoice(request.id)}
              >
                <FileText size={15} />{' '}
                {downloadingInvoiceId === request.id ? 'Descargando…' : 'Descargar factura'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!confirmed || Boolean(downloadingLetterId)}
                onClick={() => onDownloadCarriageLetter(request.id)}
              >
                <FileDown size={15} />{' '}
                {downloadingLetterId === request.id ? 'Descargando…' : 'Descargar carta de porte'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
  paymentAttemptStatus: TransportRequest['paymentAttemptStatus'],
) {
  if (status === 'pago_pendiente')
    return (
      transportPaymentAttemptNotice(paymentAttemptStatus) ??
      'Estamos esperando la confirmación del pago.'
    )
  if (status === 'por_verificar')
    return 'Pago registrado. Estamos comprobando la disponibilidad de ruta.'
  if (status === 'confirmada')
    return 'Tu transporte está confirmado. Te avisaremos con los detalles.'
  if (status === 'en_ruta') return 'El transporte ya está en ruta.'
  if (status === 'entregada') return 'El transporte se ha completado.'
  if (status === 'rechazada')
    return 'No hemos podido asignar esta solicitud. Puedes contactar con nosotros para revisarla.'
  if (status === 'cancelada') return 'Esta solicitud está cancelada. Si tienes dudas, contáctanos.'
  return ''
}
