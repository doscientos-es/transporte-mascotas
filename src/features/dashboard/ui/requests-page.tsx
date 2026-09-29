import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  Pagination,
} from '@doscientos/ui'
import { ChevronRight, PawPrint, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  confirmTransportRequest,
  loadTransportRequests,
  rejectTransportRequest,
  updateTransportRequestAnimalBox,
} from '@/features/client-portal'
import {
  transportBoxCategoryLabel,
  transportBoxOptions,
} from '@/shared/application/transport-boxes'
import { paginate } from '@/shared/lib/pagination'
import type { DailyRoute, TransportRequest } from '@/shared/types'
import { PageIntro } from '@/shared/ui/page-intro'
import { StatusBadge } from '@/shared/ui/status-badge'
import { WhatsAppLink } from '@/shared/ui/whatsapp-link'

type Props = { routes: DailyRoute[]; onNotify: (message: string) => void }

type Assignment = { routeId: string; pickupStopId: string; deliveryStopId: string; note: string }

const emptyAssignment: Assignment = { routeId: '', pickupStopId: '', deliveryStopId: '', note: '' }
const REQUEST_PAGE_SIZE = 8

const pluralize = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`

const formatDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const formatAmount = (cents: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100)

function requestMessage(request: TransportRequest) {
  const trip = `${request.origin} → ${request.destination} del ${formatDate(request.desiredDate)}`
  const greeting = `Hola ${request.contactName}, te escribimos de Kache Envíos sobre tu transporte ${trip}.`
  const detail: Partial<Record<TransportRequest['status'], string>> = {
    pago_pendiente: 'Te recordamos que el pago está pendiente para poder tramitar la solicitud.',
    por_verificar: 'Hemos recibido tu solicitud y la estamos revisando.',
    confirmada: 'Tu transporte está confirmado.',
    en_ruta: 'Tu mascota ya está en ruta.',
  }
  return [greeting, detail[request.status]].filter(Boolean).join(' ')
}

export function RequestsPage({ routes, onNotify }: Props) {
  const [requests, setRequests] = useState<TransportRequest[]>([])
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({})
  const [busy, setBusy] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [rejecting, setRejecting] = useState<TransportRequest | null>(null)
  const [pendingPage, setPendingPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [awaitingPage, setAwaitingPage] = useState(1)

  const refresh = useCallback(async () => {
    setRequests(await loadTransportRequests())
  }, [])

  const refreshRequests = useCallback(async () => {
    setRefreshing(true)
    try {
      await refresh()
    } catch {
      onNotify('No se han podido cargar las solicitudes.')
    } finally {
      setRefreshing(false)
      setLoaded(true)
    }
  }, [onNotify, refresh])

  useEffect(() => {
    void refreshRequests()
  }, [refreshRequests])

  const assignmentFor = (requestId: string) => assignments[requestId] ?? emptyAssignment
  const update = (requestId: string, patch: Partial<Assignment>) =>
    setAssignments((current) => ({
      ...current,
      [requestId]: { ...assignmentFor(requestId), ...patch },
    }))

  async function confirm(request: TransportRequest) {
    const assignment = assignmentFor(request.id)
    if (!assignment.routeId || !assignment.pickupStopId || !assignment.deliveryStopId)
      return onNotify('Elige la ruta y las paradas de recogida y entrega.')
    const route = routes.find((item) => item.id === assignment.routeId)
    const pickupIndex = route?.stops?.findIndex((stop) => stop.id === assignment.pickupStopId) ?? -1
    const deliveryIndex =
      route?.stops?.findIndex((stop) => stop.id === assignment.deliveryStopId) ?? -1
    if (pickupIndex < 0 || deliveryIndex <= pickupIndex)
      return onNotify('La parada de entrega debe estar después de la recogida en la ruta elegida.')
    setBusy(request.id)
    try {
      await confirmTransportRequest(
        request.id,
        assignment.routeId,
        assignment.pickupStopId,
        assignment.deliveryStopId,
        assignment.note,
      )
      onNotify('Solicitud confirmada: carta creada y box asignado en la ruta.')
      try {
        await refresh()
      } catch {
        onNotify('Solicitud confirmada. No se ha podido actualizar la lista todavía.')
      }
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'No se ha podido confirmar la solicitud.')
    } finally {
      setBusy('')
    }
  }

  async function reject(request: TransportRequest) {
    setBusy(request.id)
    try {
      await rejectTransportRequest(request.id, assignmentFor(request.id).note)
      onNotify('Solicitud rechazada.')
      setRejecting(null)
      await refresh()
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'No se ha podido rechazar la solicitud.')
    } finally {
      setBusy('')
    }
  }

  async function changeAnimalBox(request: TransportRequest, animalId: string, category: string) {
    if (!category) return
    setBusy(request.id)
    try {
      await updateTransportRequestAnimalBox(
        animalId,
        category as NonNullable<TransportRequest['animals'][number]['assignedBoxCategory']>,
      )
      onNotify('Categoría de box actualizada.')
      await refresh()
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'No se ha podido cambiar el box.')
    } finally {
      setBusy('')
    }
  }

  const pending = requests.filter((request) => request.status === 'por_verificar')
  const awaitingPayment = requests.filter((request) => request.status === 'pago_pendiente')
  const rest = requests.filter(
    (request) => request.status !== 'por_verificar' && request.status !== 'pago_pendiente',
  )
  const availableRoutesFor = (request: TransportRequest) =>
    routes.filter((route) => route.status === 'activa' && route.date === request.desiredDate)
  const pendingPagination = paginate(pending, pendingPage, REQUEST_PAGE_SIZE)
  const awaitingPagination = paginate(awaitingPayment, awaitingPage, REQUEST_PAGE_SIZE)
  const historyPagination = paginate(rest, historyPage, REQUEST_PAGE_SIZE)

  return (
    <>
      <PageIntro text="Gestiona las solicitudes de transporte recibidas desde el portal de clientes.">
        <Button
          variant="outline"
          disabled={refreshing || Boolean(busy)}
          onClick={() => void refreshRequests()}
        >
          <RefreshCw className={refreshing ? 'is-spinning' : ''} size={15} />{' '}
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </PageIntro>
      <Card className="table-card">
        <CardContent>
          <div className="table-heading">
            <div>
              <h3>Solicitudes de transporte pendientes</h3>
              <p>
                {pluralize(pending.length, 'solicitud pendiente', 'solicitudes pendientes')} de
                asignar
              </p>
            </div>
            <StatusBadge status="por_verificar">
              {pluralize(pending.length, 'pendiente', 'pendientes')}
            </StatusBadge>
          </div>
          {!loaded ? (
            <p className="empty-copy" aria-busy="true">
              Cargando solicitudes…
            </p>
          ) : pending.length === 0 ? (
            <p className="empty-copy">No hay solicitudes pendientes de verificar.</p>
          ) : (
            pendingPagination.items.map((request) => {
              const assignment = assignmentFor(request.id)
              const route = routes.find((item) => item.id === assignment.routeId)
              const stops = route?.stops ?? []
              const pickupIndex = stops.findIndex((stop) => stop.id === assignment.pickupStopId)
              const pickupStops = stops.slice(0, -1)
              const deliveryStops = pickupIndex >= 0 ? stops.slice(pickupIndex + 1) : []
              const availableRoutes = availableRoutesFor(request)
              return (
                <div
                  className="rounded-xl border border-[#e2e2e2] bg-[#fafafa] p-[13px]"
                  key={request.id}
                >
                  <div className="mb-3 flex items-center justify-between gap-2.5 text-[13px] text-[#222]">
                    <span className="flex flex-wrap items-center gap-2">
                      {request.contactName} · {request.contactPhone}
                      <WhatsAppLink
                        phone={request.contactPhone}
                        message={requestMessage(request)}
                        recipient={request.contactName}
                      />
                    </span>
                    <span className="route-cell">
                      <b>{request.origin}</b>
                      <ChevronRight size={14} />
                      <b>{request.destination}</b>
                    </span>
                  </div>
                  <div className="request-details">
                    <span>
                      <b>Fecha solicitada</b>
                      {formatDate(request.desiredDate)}
                    </span>
                    <span>
                      <b>Mascotas</b>
                      <span className="grid gap-2">
                        {request.animals.map((animal) => {
                          const minimumCategory = animal.minimumBoxCategory ?? 'pequeno'
                          return (
                            <span className="grid gap-1" key={animal.id ?? animal.ordinal}>
                              <span>
                                {animal.species} · {animal.weightKg} kg · recomendación:{' '}
                                {transportBoxCategoryLabel(minimumCategory)}
                              </span>
                              {animal.id && (
                                <select
                                  value={animal.assignedBoxCategory ?? animal.requestedBoxCategory}
                                  onChange={(event) =>
                                    void changeAnimalBox(
                                      request,
                                      animal.id ?? '',
                                      event.target.value,
                                    )
                                  }
                                  disabled={Boolean(busy)}
                                  aria-label={`Box de ${animal.name || animal.species}`}
                                >
                                  {transportBoxOptions(minimumCategory, animal.weightKg).map(
                                    (category) => (
                                      <option value={category} key={category}>
                                        {transportBoxCategoryLabel(category)}
                                      </option>
                                    ),
                                  )}
                                </select>
                              )}
                            </span>
                          )
                        })}
                      </span>
                    </span>
                    <span>
                      <b>Pago</b>
                      {request.paymentReference === 'admin_manual'
                        ? 'Alta manual · sin cobro'
                        : request.paidAt
                          ? `Registrado el ${new Date(request.paidAt).toLocaleDateString('es-ES')}`
                          : 'Pendiente de confirmar'}
                    </span>
                    {request.notes && (
                      <span>
                        <b>Observaciones</b>
                        {request.notes}
                      </span>
                    )}
                  </div>
                  <div className="mb-3 grid gap-3 sm:grid-cols-2 [&_input]:min-h-10 [&_select]:min-h-10 [&>label]:grid [&>label]:gap-1.5 [&>label]:text-xs [&>label]:font-bold [&>label]:text-[#454545]">
                    <label>
                      Ruta diaria
                      <select
                        value={assignment.routeId}
                        onChange={(event) =>
                          update(request.id, {
                            routeId: event.target.value,
                            pickupStopId: '',
                            deliveryStopId: '',
                          })
                        }
                        disabled={Boolean(busy)}
                      >
                        <option value="">Selecciona una ruta</option>
                        {availableRoutes.map((item) => (
                          <option value={item.id} key={item.id}>
                            {formatDate(item.date)} ·{' '}
                            {item.direction === 'inversa' ? 'sentido inverso' : 'sentido habitual'}
                          </option>
                        ))}
                        {!availableRoutes.length && (
                          <option value="" disabled>
                            No hay rutas activas para ese día
                          </option>
                        )}
                      </select>
                    </label>
                    <label>
                      Nota para el cliente
                      <input
                        value={assignment.note}
                        onChange={(event) => update(request.id, { note: event.target.value })}
                        disabled={Boolean(busy)}
                        placeholder="Opcional"
                      />
                    </label>
                    <label>
                      Parada de recogida
                      <select
                        value={assignment.pickupStopId}
                        onChange={(event) =>
                          update(request.id, {
                            pickupStopId: event.target.value,
                            deliveryStopId: '',
                          })
                        }
                        disabled={!stops.length || Boolean(busy)}
                      >
                        <option value="">Selecciona una parada</option>
                        {pickupStops.map((stop) => (
                          <option value={stop.id} key={stop.id}>
                            {stop.locality}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Parada de entrega
                      <select
                        value={assignment.deliveryStopId}
                        onChange={(event) =>
                          update(request.id, { deliveryStopId: event.target.value })
                        }
                        disabled={
                          !assignment.pickupStopId || !deliveryStops.length || Boolean(busy)
                        }
                      >
                        <option value="">Selecciona una parada</option>
                        {deliveryStops.map((stop) => (
                          <option value={stop.id} key={stop.id}>
                            {stop.locality}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="row-actions">
                    <Button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void confirm(request)}
                    >
                      {busy === request.id ? 'Guardando…' : 'Confirmar'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={Boolean(busy)}
                      onClick={() => setRejecting(request)}
                    >
                      Rechazar
                    </Button>
                  </div>
                </div>
              )
            })
          )}
          {pending.length > 0 && (
            <Pagination
              page={pendingPagination.page}
              pageCount={pendingPagination.pageCount}
              ariaLabel="Paginación de solicitudes pendientes"
              onPageChange={setPendingPage}
              summary={`Mostrando ${pendingPagination.firstRecord}–${pendingPagination.lastRecord} de ${pending.length}`}
            />
          )}
        </CardContent>
      </Card>
      <Card className="table-card">
        <CardContent>
          <div className="table-heading">
            <div>
              <h3>Pendientes de pago</h3>
              <p>
                {pluralize(
                  awaitingPayment.length,
                  'solicitud esperando el pago del cliente',
                  'solicitudes esperando el pago del cliente',
                )}
              </p>
            </div>
            <StatusBadge status="pago_pendiente">{awaitingPayment.length} sin pagar</StatusBadge>
          </div>
          {!loaded ? null : awaitingPayment.length === 0 ? (
            <p className="empty-copy">No hay solicitudes pendientes de pago.</p>
          ) : (
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Trayecto</th>
                    <th>Mascotas</th>
                    <th>Fecha</th>
                    <th>Importe</th>
                    <th>Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {awaitingPagination.items.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <strong>{request.contactName}</strong>
                        <small>{request.contactPhone}</small>
                        <WhatsAppLink
                          phone={request.contactPhone}
                          message={requestMessage(request)}
                          recipient={request.contactName}
                        />
                      </td>
                      <td>
                        <span className="route-cell">
                          <b>{request.origin}</b>
                          <ChevronRight size={14} />
                          <b>{request.destination}</b>
                        </span>
                      </td>
                      <td>
                        {request.animals.map((animal) => animal.name || animal.species).join(', ')}
                      </td>
                      <td>{formatDate(request.desiredDate)}</td>
                      <td>{formatAmount(request.amountCents)}</td>
                      <td>{new Date(request.createdAt).toLocaleDateString('es-ES')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {awaitingPayment.length > 0 && (
            <Pagination
              page={awaitingPagination.page}
              pageCount={awaitingPagination.pageCount}
              ariaLabel="Paginación de solicitudes pendientes de pago"
              onPageChange={setAwaitingPage}
              summary={`Mostrando ${awaitingPagination.firstRecord}–${awaitingPagination.lastRecord} de ${awaitingPayment.length}`}
            />
          )}
        </CardContent>
      </Card>
      <Card className="table-card">
        <CardContent>
          <div className="table-heading">
            <div>
              <h3>Histórico</h3>
              <p>
                {pluralize(rest.length, 'solicitud ya gestionada', 'solicitudes ya gestionadas')}
              </p>
            </div>
          </div>
          {!loaded ? null : rest.length === 0 ? (
            <p className="empty-copy">Todavía no hay solicitudes resueltas.</p>
          ) : (
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Trayecto</th>
                    <th>Mascotas</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {historyPagination.items.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <strong>{request.contactName}</strong>
                        <small>{request.contactPhone}</small>
                        <WhatsAppLink
                          phone={request.contactPhone}
                          message={requestMessage(request)}
                          recipient={request.contactName}
                        />
                      </td>
                      <td>
                        <span className="route-cell">
                          <b>{request.origin}</b>
                          <ChevronRight size={14} />
                          <b>{request.destination}</b>
                        </span>
                      </td>
                      <td>
                        <div className="grid gap-1.5">
                          {request.animals.map((animal) => {
                            const minimumCategory = animal.minimumBoxCategory ?? 'pequeno'
                            return (
                              <label
                                className="grid gap-0.5 text-xs"
                                key={animal.id ?? animal.ordinal}
                              >
                                <span className="flex items-center gap-1.5">
                                  <PawPrint size={13} /> {animal.name || animal.species}
                                </span>
                                {animal.id && (
                                  <select
                                    value={
                                      animal.assignedBoxCategory ?? animal.requestedBoxCategory
                                    }
                                    onChange={(event) =>
                                      void changeAnimalBox(
                                        request,
                                        animal.id ?? '',
                                        event.target.value,
                                      )
                                    }
                                    disabled={Boolean(busy)}
                                    aria-label={`Box de ${animal.name || animal.species}`}
                                  >
                                    {transportBoxOptions(minimumCategory, animal.weightKg).map(
                                      (category) => (
                                        <option value={category} key={category}>
                                          {transportBoxCategoryLabel(category)}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                )}
                              </label>
                            )
                          })}
                        </div>
                      </td>
                      <td>{formatDate(request.desiredDate)}</td>
                      <td>
                        <StatusBadge status={request.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rest.length > 0 && (
            <Pagination
              page={historyPagination.page}
              pageCount={historyPagination.pageCount}
              ariaLabel="Paginación del histórico de solicitudes"
              onPageChange={setHistoryPage}
              summary={`Mostrando ${historyPagination.firstRecord}–${historyPagination.lastRecord} de ${rest.length}`}
            />
          )}
        </CardContent>
      </Card>
      <AlertDialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setRejecting(null)
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader className="gap-1">
            <AlertDialogTitle>Rechazar solicitud</AlertDialogTitle>
            <AlertDialogDescription>
              {rejecting
                ? `¿Rechazar la solicitud de ${rejecting.contactName} (${rejecting.origin} → ${rejecting.destination})? El cliente verá la nota que hayas escrito.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busy)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={Boolean(busy)}
              onClick={() => rejecting && void reject(rejecting)}
            >
              {busy ? 'Rechazando…' : 'Rechazar solicitud'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
