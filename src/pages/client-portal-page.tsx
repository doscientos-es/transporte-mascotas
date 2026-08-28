import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Session } from '@supabase/supabase-js'
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FilePlus2,
  PawPrint,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { DashboardLayout } from '../components/dashboard-layout'
import { PageIntro } from '../components/page-intro'
import { useDashboardNavigation } from '../hooks/use-dashboard-navigation'
import { clientSections } from '../lib/dashboard-navigation'
import { supabase } from '../lib/supabase'
import { statusLabels } from '../lib/status-labels'
import {
  createTransportRequest,
  loadTransportRequests,
  loadUpcomingRoutes,
  payTransportRequest,
} from '../lib/transport-requests'
import type {
  TransportRequest,
  TransportRequestAnimal,
  UpcomingRoute,
  UserProfile,
} from '../lib/types'
import { ClientRequestForm, type RequestFormValues } from './client-request-form'

type Props = { session: Session | null; profile: UserProfile }

const formatDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

export function ClientPortalPage({ session, profile }: Props) {
  const { section, navigateToSection, replaceWithSection } =
    useDashboardNavigation('mis-transportes')
  const [routes, setRoutes] = useState<UpcomingRoute[]>([])
  const [requests, setRequests] = useState<TransportRequest[]>([])
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const userId = session?.user.id

  async function signOut() {
    if (!supabase || !session) return
    await supabase.auth.signOut()
  }

  const refresh = useCallback(async () => {
    if (!userId) return
    const [nextRoutes, nextRequests] = await Promise.all([
      loadUpcomingRoutes(),
      loadTransportRequests(userId),
    ])
    setRoutes(nextRoutes)
    setRequests(nextRequests)
  }, [userId])

  useEffect(() => {
    refresh().catch(() => setError('No hemos podido cargar tus datos. Vuelve a intentarlo.'))
  }, [refresh])
  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [notice])
  useEffect(() => {
    if (!clientSections.has(section)) replaceWithSection('mis-transportes')
  }, [replaceWithSection, section])

  async function submitRequest(values: RequestFormValues) {
    if (!userId) throw new Error('Inicia sesión para enviar una solicitud.')
    const requestId = await createTransportRequest(values)
    await payTransportRequest(requestId)
    setShowForm(false)
    setNotice('Pago registrado. Estamos revisando tu solicitud y te avisaremos al asignar la ruta.')
    await refresh()
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
      role="user"
      displayName={profile.displayName}
      onNavigate={navigateToSection}
      onSignOut={signOut}
    >
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
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
              contactName={profile.displayName}
              contactPhone={profile.phone}
              contactEmail={session?.user.email ?? ''}
              onSubmit={submitRequest}
              onCancel={() => setShowForm(false)}
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
        <div className="toast" role="status">
          <CheckCircle2 size={18} /> {notice}
        </div>
      )}
    </DashboardLayout>
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
