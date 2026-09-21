import { Button, Card, CardContent, Pagination } from '@doscientos/ui'
import { ChevronRight, ClipboardList, PawPrint, RefreshCw } from 'lucide-react'
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

type Props = { routes: DailyRoute[]; onNotify: (message: string) => void }

type Assignment = { routeId: string; pickupStopId: string; deliveryStopId: string; note: string }

const emptyAssignment: Assignment = { routeId: '', pickupStopId: '', deliveryStopId: '', note: '' }
const REQUEST_PAGE_SIZE = 8

const formatDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

export function RequestsPage({ routes, onNotify }: Props) {
  const [requests, setRequests] = useState<TransportRequest[]>([])
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({})
  const [busy, setBusy] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [pendingPage, setPendingPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)

  const refresh = useCallback(async () => {
    const loaded = await loadTransportRequests()
    setRequests(loaded)
  }, [])

  const refreshRequests = useCallback(async () => {
    setRefreshing(true)
    try {
      await refresh()
    } catch {
      onNotify('No se han podido cargar las solicitudes.')
    } finally {
      setRefreshing(false)
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
  const rest = requests.filter((request) => request.status !== 'por_verificar')
  const availableRoutesFor = (request: TransportRequest) =>
    routes.filter((route) => route.status === 'activa' && route.date === request.desiredDate)
  const pendingPagination = paginate(pending, pendingPage, REQUEST_PAGE_SIZE)
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
              <p>{pending.length} solicitudes pagadas pendientes de asignar</p>
            </div>
            <StatusBadge status="por_verificar">{pending.length} pendientes</StatusBadge>
          </div>
          {pending.length === 0 ? (
            <p className="empty-copy">No hay solicitudes pendientes de verificar.</p>
          ) : (
            pendingPagination.items.map((request) => {
              const assignment = assignmentFor(request.id)
              const route = routes.find((item) => item.id === assignment.routeId)
              const stops = route?.stops ?? []
              const pickupIndex = stops.findIndex((stop) => stop.id === assignment.pickupStopId)
              const deliveryStops = pickupIndex >= 0 ? stops.slice(pickupIndex + 1) : []
              const availableRoutes = availableRoutesFor(request)
              return (
                <div
                  className="rounded-xl border border-[#e2e2e2] bg-[#fafafa] p-[13px]"
                  key={request.id}
                >
                  <div className="mb-3 flex items-center justify-between gap-2.5 text-[13px] text-[#222]">
                    <span>
                      {request.contactName} · {request.contactPhone}
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
                                  aria-label={`Box de ${animal.name}`}
                                >
                                  {transportBoxOptions(minimumCategory).map((category) => (
                                    <option value={category} key={category}>
                                      {transportBoxCategoryLabel(category)}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </span>
                          )
                        })}
                      </span>
                    </span>
                    <span>
                      <b>Pago</b>
                      {request.paidAt
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
                        placeholder="Opcional"
                      />
                    </label>
                    <label>
                      Parada de recogida
                      <select
                        value={assignment.pickupStopId}
                        onChange={(event) =>
                          update(request.id, { pickupStopId: event.target.value })
                        }
                        disabled={!stops.length || Boolean(busy)}
                      >
                        <option value="">Selecciona una parada</option>
                        {deliveryStops.map((stop) => (
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
                        disabled={!stops.length || Boolean(busy)}
                      >
                        <option value="">Selecciona una parada</option>
                        {stops.map((stop) => (
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
                      Confirmar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={Boolean(busy)}
                      onClick={() => void reject(request)}
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
              <h3>Histórico</h3>
              <p>{rest.length} solicitudes ya gestionadas</p>
            </div>
          </div>
          {rest.length === 0 ? (
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
                                    aria-label={`Box de ${animal.name}`}
                                  >
                                    {transportBoxOptions(minimumCategory).map((category) => (
                                      <option value={category} key={category}>
                                        {transportBoxCategoryLabel(category)}
                                      </option>
                                    ))}
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
      {requests.length === 0 && (
        <p className="empty-copy">
          <ClipboardList size={15} /> Las solicitudes del portal de clientes aparecerán aquí.
        </p>
      )}
    </>
  )
}
