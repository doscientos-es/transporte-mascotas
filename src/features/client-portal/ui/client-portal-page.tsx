import { Button, Card, CardContent } from '@doscientos/ui'
import type { Session } from '@supabase/supabase-js'
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FilePlus2,
  Navigation,
  PawPrint,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { statusLabels } from '@/shared/lib/status-labels'
import type {
  ClientPet,
  DashboardNavigation,
  TransportRequest,
  TransportRequestAnimal,
  UpcomingRoute,
  UserProfile,
} from '@/shared/types'
import { DashboardLayout } from '@/shared/ui/dashboard-layout'
import { PageIntro } from '@/shared/ui/page-intro'

import { signOut as signOutSession } from '../application/session'
import {
  createTransportRequest,
  loadClientPets,
  loadTransportRequests,
  loadUpcomingRoutes,
  payTransportRequest,
  saveClientPets,
} from '../application/transport-requests'
import { ClientRequestForm, type RequestFormValues } from './client-request-form'

type Props = { session: Session | null; profile: UserProfile; navigation: DashboardNavigation }

const formatDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

function mapsEmbedUrl(latitude: number, longitude: number) {
  const delta = 0.012
  return `https://www.openstreetmap.org/export/embed.html?${new URLSearchParams({
    bbox: `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`,
    layer: 'mapnik',
    marker: `${latitude},${longitude}`,
  })}`
}

function googleMapsDirectionsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
}

export function ClientPortalPage({ session, profile, navigation }: Props) {
  const { section, navigateToSection } = navigation
  const [routes, setRoutes] = useState<UpcomingRoute[]>([])
  const [requests, setRequests] = useState<TransportRequest[]>([])
  const [savedPets, setSavedPets] = useState<ClientPet[]>([])
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingPaymentRequestId, setPendingPaymentRequestId] = useState<string | null>(null)
  const userId = session?.user.id

  async function signOut() {
    if (!session) return
    try {
      await signOutSession()
    } catch {
      setError('No hemos podido cerrar la sesión. Vuelve a intentarlo.')
    }
  }

  const refresh = useCallback(async () => {
    if (!userId) return
    const [nextRoutes, nextRequests, nextPets] = await Promise.all([
      loadUpcomingRoutes(),
      loadTransportRequests(userId),
      loadClientPets(),
    ])
    setRoutes(nextRoutes)
    setRequests(nextRequests)
    setSavedPets(nextPets)
    setPendingPaymentRequestId((current) => {
      const currentIsPending = nextRequests.some(
        (request) => request.id === current && request.status === 'pago_pendiente',
      )
      return currentIsPending
        ? current
        : (nextRequests.find((request) => request.status === 'pago_pendiente')?.id ?? null)
    })
    setError('')
  }, [userId])

  useEffect(() => {
    let active = true
    setLoading(true)
    refresh()
      .catch(() => active && setError('No hemos podido cargar tus datos. Vuelve a intentarlo.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [refresh])
  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [notice])
  async function refreshData() {
    setLoading(true)
    setError('')
    try {
      await refresh()
    } catch {
      setError('No hemos podido actualizar tus datos. Comprueba tu conexión y vuelve a intentarlo.')
    } finally {
      setLoading(false)
    }
  }

  async function completeRequestPayment(requestId: string) {
    await payTransportRequest(requestId)
    setPendingPaymentRequestId(null)
    setNotice('Pago registrado. Estamos revisando tu solicitud y te avisaremos al asignar la ruta.')
    try {
      await refresh()
    } catch {
      setError(
        'El pago está registrado, pero no hemos podido actualizar la información. Reinténtalo más tarde.',
      )
    }
  }

  async function submitRequest(values?: RequestFormValues) {
    if (!userId) throw new Error('Inicia sesión para enviar una solicitud.')
    if (!values && !pendingPaymentRequestId) throw new Error('Completa los datos de la solicitud.')
    let requestId: string
    if (pendingPaymentRequestId) {
      requestId = pendingPaymentRequestId
    } else {
      if (!values) throw new Error('Completa los datos de la solicitud.')
      requestId = await createTransportRequest(values)
    }
    setPendingPaymentRequestId(requestId)
    try {
      await completeRequestPayment(requestId)
    } catch {
      try {
        const currentRequests = await loadTransportRequests(userId)
        setRequests(currentRequests)
        const request = currentRequests.find((item) => item.id === requestId)
        if (request?.status === 'por_verificar') {
          setPendingPaymentRequestId(null)
          setNotice(
            'Pago registrado. Estamos revisando tu solicitud y te avisaremos al asignar la ruta.',
          )
          return
        }
      } catch {
        // The request remains recoverable through its id; do not create a duplicate on retry.
      }
      throw new Error(
        'Hemos guardado tu solicitud, pero no hemos podido registrar el pago. Reinténtalo: no se creará otra solicitud.',
      )
    }
  }

  async function saveRecurringPets(animals: TransportRequestAnimal[]) {
    await saveClientPets(animals)
    setSavedPets(await loadClientPets())
    setNotice('Mascota guardada. La próxima vez podrás elegirla y revisar sus datos.')
  }

  const awaitingReview = requests.filter(
    (request) => request.status === 'por_verificar' || request.status === 'pago_pendiente',
  ).length
  const confirmed = requests.filter(
    (request) => request.status === 'confirmada' || request.status === 'en_ruta',
  ).length

  const pets = requests.flatMap((request) =>
    request.animals.map((animal) => ({
      ...animal,
      requestId: request.id,
      requestDate: request.desiredDate,
    })),
  )

  return (
    <DashboardLayout
      section={section}
      pendingLetters={0}
      profileRole="user"
      displayName={profile.displayName}
      onNavigate={navigateToSection}
      hrefForSection={navigation.hrefForSection}
      onSignOut={() => void signOut()}
    >
      {error && (
        <div className="inline-feedback is-error" role="alert">
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refreshData()}
            disabled={loading}
          >
            <RefreshCw className={loading ? 'is-spinning' : ''} size={16} />
            {loading ? 'Actualizando…' : 'Reintentar'}
          </Button>
        </div>
      )}

      {section === 'proximas-rutas' && (
        <>
          <PageIntro text="Consulta las próximas salidas antes de solicitar tu transporte." />
          <div className="invoices-list">
            {routes.length ? (
              routes.map((route) => (
                <Card key={route.id} className="invoice-card">
                  <CardContent>
                    <div className="invoice-icon">
                      <CalendarDays size={19} />
                    </div>
                    <div>
                      <span>
                        {route.routeDirection === 'inversa'
                          ? 'Sentido inverso'
                          : 'Sentido habitual'}
                      </span>
                      <strong>{route.templateName || 'Ruta programada'}</strong>
                      <small>{route.localities.join(' · ') || 'Paradas por definir'}</small>
                    </div>
                    <div className="invoice-amount">
                      <strong>{formatDate(route.serviceDate)}</strong>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="invoice-empty">
                <CardContent>
                  <CalendarDays size={22} />
                  <div>
                    <h3>No hay rutas publicadas</h3>
                    <p>En cuanto programemos nuevas salidas las verás aquí.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {section === 'mis-transportes' && (
        <>
          <div className="client-portal-hero">
            <div>
              <span className="eyebrow">Área de cliente</span>
              <h2>El viaje de tu mascota, siempre a la vista.</h2>
              <p>
                Elige una salida programada, registra el pago y sigue cada actualización desde aquí.
              </p>
            </div>
            <Button disabled={!routes.length} onClick={() => setShowForm((current) => !current)}>
              <FilePlus2 /> {showForm ? 'Cerrar solicitud' : 'Solicitar transporte'}
            </Button>
          </div>
          {!routes.length && !loading && (
            <p className="availability-hint">
              No hay salidas publicadas por ahora. Te avisaremos cuando haya una disponible.
            </p>
          )}
          {pendingPaymentRequestId && !showForm && (
            <div className="inline-feedback is-warning" aria-live="polite">
              <p>Tienes una solicitud guardada pendiente de registrar el pago.</p>
              <Button type="button" onClick={() => setShowForm(true)}>
                Continuar
              </Button>
            </div>
          )}
          {!showForm && (
            <div className="client-overview" aria-label="Resumen de tus transportes">
              <Card>
                <CardContent>
                  <CircleDollarSign size={19} />
                  <div>
                    <span>En revisión</span>
                    <strong>{awaitingReview}</strong>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <ClipboardCheck size={19} />
                  <div>
                    <span>Confirmados</span>
                    <strong>{confirmed}</strong>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <PawPrint size={19} />
                  <div>
                    <span>Total solicitudes</span>
                    <strong>{requests.length}</strong>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {showForm && (
            <ClientRequestForm
              routes={routes}
              savedPets={savedPets}
              contactName={profile.displayName}
              contactPhone={profile.phone}
              contactEmail={session?.user.email ?? ''}
              onSubmit={submitRequest}
              onCancel={() => setShowForm(false)}
              onSavePets={saveRecurringPets}
              pendingPayment={Boolean(pendingPaymentRequestId)}
              onRetryPayment={() => submitRequest()}
            />
          )}
          {!showForm && (
            <div className="client-section-heading">
              <div>
                <h3>Mis solicitudes</h3>
                <p>
                  {requests.length
                    ? 'Consulta el estado y los detalles de cada transporte.'
                    : 'Cuando envíes una solicitud aparecerá aquí.'}
                </p>
              </div>
              {requests.length > 0 && (
                <Button variant="outline" onClick={() => setShowForm(true)}>
                  <FilePlus2 size={16} /> Nueva solicitud
                </Button>
              )}
            </div>
          )}
          {!showForm && (
            <div className="invoices-list">
              {requests.length ? (
                requests.map((request) => (
                  <Card key={request.id} className="invoice-card client-transport-card">
                    <CardContent>
                      <div className="invoice-icon">
                        <PawPrint size={19} />
                      </div>
                      <div>
                        <span>
                          {request.animals.length} mascota{request.animals.length === 1 ? '' : 's'}{' '}
                          · {formatDate(request.desiredDate)}
                        </span>
                        <strong>
                          {request.origin} → {request.destination}
                        </strong>
                        <small>{request.adminNote || clientStatusHint(request.status)}</small>
                        {typeof request.originLatitude === 'number' &&
                          typeof request.originLongitude === 'number' &&
                          typeof request.destinationLatitude === 'number' &&
                          typeof request.destinationLongitude === 'number' && (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                          )}
                      </div>
                      <div className="invoice-amount">
                        <span className={`status status-${request.status}`}>
                          {statusLabels[request.status] ?? request.status}
                        </span>
                        {request.paidAt && (
                          <small className="payment-state">
                            <CheckCircle2 size={13} /> Pago registrado
                          </small>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="invoice-empty">
                  <CardContent>
                    <PawPrint size={22} />
                    <div>
                      <h3>Todavía no tienes solicitudes</h3>
                      <p>
                        Elige una salida publicada y las necesidades de tu mascota; podrás seguirlo
                        todo desde aquí.
                      </p>
                      <Button disabled={!routes.length} onClick={() => setShowForm(true)}>
                        <FilePlus2 size={16} /> Crear solicitud
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {section === 'mis-mascotas' && (
        <>
          <PageIntro text="Estas son las mascotas incluidas en tus solicitudes de transporte." />
          <div className="invoices-list">
            {pets.length ? (
              pets.map((pet) => (
                <PetCard key={pet.id ?? `${pet.requestId}-${pet.ordinal}`} pet={pet} />
              ))
            ) : (
              <Card className="invoice-empty">
                <CardContent>
                  <PawPrint size={22} />
                  <div>
                    <h3>Aún no has añadido mascotas</h3>
                    <p>
                      Al crear una solicitud de transporte registraremos los datos de cada mascota
                      aquí.
                    </p>
                    <Button
                      onClick={() => {
                        navigateToSection('mis-transportes')
                        setShowForm(true)
                      }}
                    >
                      <FilePlus2 size={16} /> Solicitar transporte
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {notice && (
        <output className="toast">
          <CheckCircle2 size={18} /> {notice}
        </output>
      )}
    </DashboardLayout>
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
  latitude: number
  longitude: number
}) {
  return (
    <section className="border-border bg-card overflow-hidden rounded-lg border">
      <iframe
        className="h-36 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer"
        src={mapsEmbedUrl(latitude, longitude)}
        title={`Mapa de ${label.toLocaleLowerCase()} en ${location}`}
      />
      <a
        className="text-accent flex items-center gap-1.5 px-3 py-2 text-xs font-bold hover:underline"
        href={googleMapsDirectionsUrl(latitude, longitude)}
        target="_blank"
        rel="noreferrer"
      >
        <Navigation size={14} /> Cómo llegar a {label.toLocaleLowerCase()} · {location}
      </a>
    </section>
  )
}

function PetCard({ pet }: { pet: TransportRequestAnimal & { requestDate: string } }) {
  return (
    <Card className="invoice-card client-transport-card">
      <CardContent>
        <div className="invoice-icon">
          <PawPrint size={19} />
        </div>
        <div>
          <span>Mascota registrada · solicitud del {formatDate(pet.requestDate)}</span>
          <strong>{pet.breed || pet.species}</strong>
          <small>
            {pet.species}
            {pet.breed ? ` · ${pet.breed}` : ''} · {pet.weightKg} kg · {pet.lengthCm} ×{' '}
            {pet.heightCm} × {pet.widthCm} cm
          </small>
        </div>
        {pet.size && (
          <div className="invoice-amount">
            <span className="status">Tamaño {pet.size}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function clientStatusHint(status: TransportRequest['status']) {
  if (status === 'por_verificar')
    return 'Pago registrado. Estamos comprobando la disponibilidad de ruta.'
  if (status === 'confirmada')
    return 'Tu transporte está confirmado. Te avisaremos con los detalles.'
  if (status === 'en_ruta') return 'El transporte ya está en ruta.'
  if (status === 'rechazada')
    return 'No hemos podido asignar esta solicitud. Puedes contactar con nosotros para revisarla.'
  return 'Estamos esperando la confirmación del pago.'
}
