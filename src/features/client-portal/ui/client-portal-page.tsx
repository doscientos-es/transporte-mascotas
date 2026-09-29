import { Button, Card, CardContent } from '@doscientos/ui'
import type { Session } from '@supabase/supabase-js'
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  FileDown,
  FilePlus2,
  FileText,
  Navigation,
  PawPrint,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { OptionalClientAccountCard } from '@/features/auth'
import {
  defaultTransportBoxCatalog,
  transportBoxCategoryLabel,
  type TransportBoxCatalog,
} from '@/shared/application/transport-boxes'
import { loadTransportBoxCatalog } from '@/shared/infrastructure/transport-pricing'
import {
  type ClientPet,
  type DashboardNavigation,
  type TransportRequest,
  type TransportRequestAnimal,
  type UpcomingRoute,
  type UserProfile,
} from '@/shared/types'
import { DashboardLayout } from '@/shared/ui/dashboard-layout'
import { PageIntro } from '@/shared/ui/page-intro'
import { StatusBadge } from '@/shared/ui/status-badge'

import { carriageLetterFileName, createCarriageLetterPdf } from '../application/carriage-letter-pdf'
import { formatDate, mapsEmbedUrl, transportLocationMapsUrl } from '../application/route-maps'
import { signOut as signOutSession } from '../application/session'
import { isConfirmedTransport } from '../application/transport-calendar'
import {
  createTransportRequest,
  loadClientPets,
  loadTransportCarriageLetter,
  loadTransportInvoice,
  loadMyPaymentRequests,
  loadTransportRequests,
  loadUpcomingRoutes,
  payClientPaymentRequest,
  payTransportRequest,
  saveClientPets,
  type ClientPaymentRequest,
} from '../application/transport-requests'
import { ClientRequestForm, type RequestFormValues } from './client-request-form'
import { PaymentSuccessPanel } from './payment-success-panel'
import { saveFile } from './save-file'
import { submitPaymentForm } from './submit-payment-form'
import { UpcomingRouteDetail } from './upcoming-route-detail'

type Props = { session: Session | null; profile: UserProfile; navigation: DashboardNavigation }

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100)

export function ClientPortalPage({ session, profile, navigation }: Props) {
  const { section, routeId, navigateToSection, navigateToUpcomingRoute, navigateToRequestForm } =
    navigation
  const routerLocation = useLocation()
  const navigate = useNavigate()
  const navigationState = routerLocation.state as {
    preselectRouteId?: string
    paymentStatus?: 'ok' | 'ko'
    paymentRequestId?: string
  } | null
  const searchParams = new URLSearchParams(routerLocation.search)
  const paymentStatus =
    navigationState?.paymentStatus ?? (searchParams.get('payment') as 'ok' | 'ko' | null)
  const paymentRequestId = navigationState?.paymentRequestId ?? searchParams.get('request')
  const preselectRouteId = navigationState?.preselectRouteId
  const [preselectedRouteId, setPreselectedRouteId] = useState<string>()
  const [routes, setRoutes] = useState<UpcomingRoute[]>([])
  const [requests, setRequests] = useState<TransportRequest[]>([])
  const [paymentRequests, setPaymentRequests] = useState<ClientPaymentRequest[]>([])
  const [savedPets, setSavedPets] = useState<ClientPet[]>([])
  const [boxCatalog, setBoxCatalog] = useState<TransportBoxCatalog>(defaultTransportBoxCatalog)
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingPaymentRequestId, setPendingPaymentRequestId] = useState<string | null>(null)
  const [accountPromptDismissed, setAccountPromptDismissed] = useState(false)
  const [payingRequestId, setPayingRequestId] = useState<string | null>(null)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const [downloadingLetterId, setDownloadingLetterId] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState<{
    requestId: string | null
    attempts: number
  } | null>(null)
  const userId = session?.user.id
  const guestAccountEmail = session?.user.is_anonymous ? requests[0]?.contactEmail : undefined

  async function signOut() {
    if (!session) return
    try {
      await signOutSession()
    } catch {
      setError('No hemos podido cerrar la sesión. Vuelve a intentarlo.')
    }
  }

  const refresh = useCallback(async () => {
    if (!userId) return [] as TransportRequest[]
    const [nextRoutes, nextRequests, nextPets, nextBoxCatalog, nextPaymentRequests] =
      await Promise.all([
        loadUpcomingRoutes(),
        loadTransportRequests(userId),
        loadClientPets(),
        loadTransportBoxCatalog(),
        loadMyPaymentRequests().catch(() => [] as ClientPaymentRequest[]),
      ])
    setPaymentRequests(nextPaymentRequests)
    setRoutes(nextRoutes)
    setRequests(nextRequests)
    setSavedPets(nextPets)
    setBoxCatalog(nextBoxCatalog)
    setPendingPaymentRequestId((current) =>
      nextRequests.some((request) => request.id === current && request.status === 'pago_pendiente')
        ? current
        : null,
    )
    setError('')
    return nextRequests
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
  useEffect(() => {
    if (!preselectRouteId) return
    setPreselectedRouteId(preselectRouteId)
    setPendingPaymentRequestId(null)
    setShowForm(true)
    void navigate(
      { pathname: routerLocation.pathname, search: routerLocation.search },
      { replace: true, state: null },
    )
  }, [navigate, preselectRouteId, routerLocation.pathname, routerLocation.search])
  useEffect(() => {
    if (!paymentStatus || !userId) return
    void navigate(routerLocation.pathname, { replace: true, state: null })
    if (paymentStatus === 'ok') {
      setShowForm(false)
      setPaymentSuccess({ requestId: paymentRequestId || null, attempts: 0 })
      void refresh().catch(() => {
        setError('El pago se ha recibido, pero no hemos podido actualizar el estado todavía.')
      })
    } else if (paymentStatus === 'ko') {
      setError('El pago no se ha completado. Puedes reintentarlo desde Mis transportes.')
    }
  }, [navigate, paymentRequestId, paymentStatus, refresh, routerLocation.pathname, userId])

  const successRequest = paymentSuccess
    ? paymentSuccess.requestId
      ? requests.find((request) => request.id === paymentSuccess.requestId)
      : requests[0]
    : undefined
  const confirmingPayment = Boolean(
    paymentSuccess &&
    paymentSuccess.attempts < 10 &&
    (!successRequest || !isConfirmedTransport(successRequest.status)),
  )
  useEffect(() => {
    if (!confirmingPayment) return
    const timeout = window.setTimeout(() => {
      void refresh()
        .catch(() => undefined)
        .finally(() =>
          setPaymentSuccess((current) =>
            current ? { ...current, attempts: current.attempts + 1 } : current,
          ),
        )
    }, 3000)
    return () => window.clearTimeout(timeout)
  }, [confirmingPayment, paymentSuccess?.attempts, refresh])

  async function downloadInvoice(requestId: string) {
    const { file, fileName } = await loadTransportInvoice(requestId)
    saveFile(file, fileName)
  }

  async function downloadCarriageLetter(requestId: string) {
    const letter = await loadTransportCarriageLetter(requestId)
    saveFile(await createCarriageLetterPdf(letter), carriageLetterFileName(letter))
  }

  async function downloadRequestCarriageLetter(requestId: string) {
    if (downloadingLetterId) return
    setError('')
    setDownloadingLetterId(requestId)
    try {
      await downloadCarriageLetter(requestId)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se ha podido descargar la carta de porte.',
      )
    } finally {
      setDownloadingLetterId(null)
    }
  }

  async function downloadRequestInvoice(requestId: string) {
    if (downloadingInvoiceId) return
    setError('')
    setDownloadingInvoiceId(requestId)
    try {
      await downloadInvoice(requestId)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido descargar la factura.')
    } finally {
      setDownloadingInvoiceId(null)
    }
  }
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
    submitPaymentForm(await payTransportRequest(requestId))
  }

  async function continuePayment(requestId: string) {
    if (payingRequestId) return
    setError('')
    setPayingRequestId(requestId)
    try {
      await completeRequestPayment(requestId)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido abrir el pago.')
      setPayingRequestId(null)
    }
  }

  async function continueClientPaymentRequest(invoiceId: string) {
    if (payingRequestId) return
    setError('')
    setPayingRequestId(invoiceId)
    try {
      submitPaymentForm(await payClientPaymentRequest(invoiceId))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido abrir el pago.')
      setPayingRequestId(null)
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

  function openNewRequestForm() {
    setPreselectedRouteId(undefined)
    setShowForm(true)
  }

  const unpaidRequest = requests.find((request) => request.status === 'pago_pendiente')
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

      {section === 'proximas-rutas' &&
        (routeId ? (
          (() => {
            const route = routes.find((item) => item.id === routeId)
            if (!route && loading)
              return (
                <Card className="invoice-empty" aria-busy="true">
                  <CardContent>
                    <RefreshCw className="is-spinning" size={22} />
                    <div>
                      <h3>Cargando ruta…</h3>
                    </div>
                  </CardContent>
                </Card>
              )
            return route ? (
              <UpcomingRouteDetail
                route={route}
                onBack={() => navigateToSection('proximas-rutas')}
                onSelect={() => navigateToRequestForm(route.id)}
              />
            ) : (
              <Card className="invoice-empty">
                <CardContent>
                  <CalendarDays size={22} />
                  <div>
                    <h3>Ruta no encontrada</h3>
                    <p>Puede que ya no esté disponible. Vuelve a la lista de próximas rutas.</p>
                    <Button onClick={() => navigateToSection('proximas-rutas')}>
                      Volver a próximas rutas
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })()
        ) : (
          <>
            <PageIntro text="Consulta las próximas salidas antes de solicitar tu transporte." />
            <div className="invoices-list">
              {routes.length ? (
                routes.map((route) => (
                  <Card
                    key={route.id}
                    className="invoice-card cursor-pointer"
                    onClick={() => navigateToUpcomingRoute(route.id)}
                  >
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
                      <div className="invoice-amount flex flex-col items-end gap-2">
                        <strong>{formatDate(route.serviceDate)}</strong>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Ver detalles de ${route.templateName || 'la ruta'} del ${formatDate(route.serviceDate)}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              navigateToUpcomingRoute(route.id)
                            }}
                          >
                            Detalles
                          </Button>
                          <Button
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation()
                              navigateToRequestForm(route.id)
                            }}
                          >
                            <FilePlus2 size={14} /> Seleccionar
                          </Button>
                        </div>
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
        ))}

      {section === 'mis-transportes' && paymentSuccess && (
        <PaymentSuccessPanel
          request={successRequest}
          confirming={confirmingPayment}
          formatCurrency={formatCurrency}
          onDownloadInvoice={downloadInvoice}
          onDownloadCarriageLetter={downloadCarriageLetter}
          onClose={() => setPaymentSuccess(null)}
        />
      )}

      {section === 'mis-transportes' && !paymentSuccess && (
        <>
          <div className="client-portal-hero">
            <div>
              <h2>El viaje de tu mascota, siempre a la vista.</h2>
              <p>
                Elige una salida programada, registra el pago y sigue cada actualización desde aquí.
              </p>
            </div>
            <Button
              disabled={!routes.length}
              onClick={() => (showForm ? setShowForm(false) : openNewRequestForm())}
            >
              <FilePlus2 /> {showForm ? 'Cerrar solicitud' : 'Solicitar transporte'}
            </Button>
          </div>
          {!routes.length && !loading && (
            <p className="availability-hint">
              No hay salidas publicadas por ahora. Te avisaremos cuando haya una disponible.
            </p>
          )}
          {!showForm && (pendingPaymentRequestId || unpaidRequest) && (
            <div className="inline-feedback is-warning" aria-live="polite">
              <p>Tienes una solicitud guardada pendiente de registrar el pago.</p>
              <Button
                type="button"
                disabled={Boolean(payingRequestId)}
                onClick={() =>
                  pendingPaymentRequestId
                    ? setShowForm(true)
                    : unpaidRequest && void continuePayment(unpaidRequest.id)
                }
              >
                <CreditCard size={15} />{' '}
                {payingRequestId && payingRequestId === unpaidRequest?.id
                  ? 'Abriendo pago…'
                  : 'Continuar pago'}
              </Button>
            </div>
          )}
          {!showForm && guestAccountEmail && !accountPromptDismissed && (
            <OptionalClientAccountCard
              displayName={profile.displayName}
              email={guestAccountEmail}
              phone={profile.phone}
              title="Guarda tus transportes en una cuenta"
              description="Es opcional. Ahora mismo solo puedes ver tus solicitudes desde este navegador."
              onSkip={() => setAccountPromptDismissed(true)}
              onCreated={(result) => {
                setAccountPromptDismissed(true)
                setNotice(
                  result === 'created'
                    ? 'Cuenta creada. Ya puedes acceder desde cualquier dispositivo.'
                    : 'Te hemos enviado un correo para confirmar tu cuenta.',
                )
              }}
            />
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
          {showForm && loading && !routes.length && (
            <p className="availability-hint" aria-busy="true">
              Cargando salidas disponibles…
            </p>
          )}
          {showForm && (!loading || routes.length > 0) && (
            <ClientRequestForm
              key={preselectedRouteId ?? 'new'}
              routes={routes}
              savedPets={savedPets}
              contactName={profile.displayName}
              contactPhone={profile.phone}
              contactEmail={session?.user.email ?? ''}
              onSubmit={submitRequest}
              onCancel={() => setShowForm(false)}
              onSavePets={saveRecurringPets}
              boxCatalog={boxCatalog}
              pendingPayment={Boolean(pendingPaymentRequestId)}
              onRetryPayment={() => submitRequest()}
              initialRouteId={preselectedRouteId}
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
                <Button variant="outline" disabled={!routes.length} onClick={openNewRequestForm}>
                  <FilePlus2 size={16} /> Nueva solicitud
                </Button>
              )}
            </div>
          )}
          {!showForm && paymentRequests.length > 0 && (
            <div className="invoices-list">
              {paymentRequests.map((paymentRequest) => (
                <Card key={paymentRequest.id} className="invoice-card client-transport-card">
                  <CardContent>
                    <div className="invoice-icon">
                      <FilePlus2 size={19} />
                    </div>
                    <div>
                      <span>Solicitud de pago pendiente</span>
                      <strong>{paymentRequest.concept}</strong>
                      <small>{formatCurrency(paymentRequest.totalAmount * 100)}</small>
                    </div>
                    <Button
                      disabled={Boolean(payingRequestId)}
                      onClick={() => void continueClientPaymentRequest(paymentRequest.id)}
                    >
                      {payingRequestId === paymentRequest.id ? 'Abriendo pago…' : 'Pagar'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {!showForm && (
            <div className="invoices-list">
              {requests.length ? (
                requests.map((request) => (
                  <Card
                    key={request.id}
                    className={`invoice-card client-transport-card ${
                      request.status === 'por_verificar'
                        ? '!border-l-[#ca8a04]'
                        : request.status === 'confirmada' || request.status === 'en_ruta'
                          ? '!border-l-[#171717]'
                          : ''
                    }`}
                  >
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
                        <small>
                          {request.animals
                            .map((animal) =>
                              transportBoxCategoryLabel(
                                animal.assignedBoxCategory ??
                                  animal.requestedBoxCategory ??
                                  animal.minimumBoxCategory ??
                                  'pequeno',
                              ),
                            )
                            .join(' · ')}
                        </small>
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
                      </div>
                      <div className="invoice-amount">
                        <strong>{formatCurrency(request.amountCents)}</strong>
                        <StatusBadge status={request.status} />
                        {request.paidAt && (
                          <small className="payment-state">
                            <CheckCircle2 size={13} /> Pago registrado
                          </small>
                        )}
                        {(request.paidAt || isConfirmedTransport(request.status)) && (
                          <div className="client-transport-documents">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                !isConfirmedTransport(request.status) ||
                                Boolean(downloadingInvoiceId)
                              }
                              onClick={() => void downloadRequestInvoice(request.id)}
                            >
                              <FileText size={15} />{' '}
                              {downloadingInvoiceId === request.id
                                ? 'Descargando…'
                                : 'Descargar factura'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                !isConfirmedTransport(request.status) ||
                                Boolean(downloadingLetterId)
                              }
                              onClick={() => void downloadRequestCarriageLetter(request.id)}
                            >
                              <FileDown size={15} />{' '}
                              {downloadingLetterId === request.id
                                ? 'Descargando…'
                                : 'Descargar carta de porte'}
                            </Button>
                            {!isConfirmedTransport(request.status) && (
                              <span>Disponibles en cuanto confirmemos el pago</span>
                            )}
                          </div>
                        )}
                        {request.status === 'pago_pendiente' && (
                          <Button
                            className="client-transport-pay-button"
                            size="sm"
                            disabled={Boolean(payingRequestId)}
                            onClick={() => void continuePayment(request.id)}
                          >
                            <CreditCard size={15} />{' '}
                            {payingRequestId === request.id ? 'Abriendo pago…' : 'Continuar pago'}
                          </Button>
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
                      <Button disabled={!routes.length} onClick={openNewRequestForm}>
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
                      disabled={!routes.length}
                      onClick={() => {
                        navigateToSection('mis-transportes')
                        openNewRequestForm()
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
        <output className="toast" aria-live="polite">
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
  latitude?: number
  longitude?: number
}) {
  return (
    <section className="border-border bg-card overflow-hidden rounded-lg border">
      {typeof latitude === 'number' && typeof longitude === 'number' && (
        <iframe
          className="h-36 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={mapsEmbedUrl(latitude, longitude)}
          title={`Mapa de ${label.toLocaleLowerCase()} en ${location}`}
        />
      )}
      <a
        className="text-accent flex items-center gap-1.5 px-3 py-2 text-xs font-bold hover:underline"
        href={transportLocationMapsUrl(location, latitude, longitude)}
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
            <span className="status">
              Box{' '}
              {transportBoxCategoryLabel(
                pet.assignedBoxCategory ?? pet.requestedBoxCategory ?? pet.size ?? 'pequeno',
              )}
            </span>
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
