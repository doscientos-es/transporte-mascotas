import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, ClipboardList, PawPrint, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageIntro } from '../components/page-intro'
import { statusLabels } from '../lib/status-labels'
import { confirmTransportRequest, loadTransportRequests, rejectTransportRequest } from '../lib/transport-requests'
import type { DailyRoute, TransportRequest } from '../lib/types'

type Props = { routes: DailyRoute[]; onNotify: (message: string) => void }

type Assignment = { routeId: string; pickupStopId: string; deliveryStopId: string; note: string }

const emptyAssignment: Assignment = { routeId: '', pickupStopId: '', deliveryStopId: '', note: '' }

const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

export function RequestsPage({ routes, onNotify }: Props) {
  const [requests, setRequests] = useState<TransportRequest[]>([])
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({})
  const [busy, setBusy] = useState('')

  const refresh = useCallback(async () => {
    const loaded = await loadTransportRequests()
    setRequests(loaded)
  }, [])

  useEffect(() => { refresh().catch(() => onNotify('No se han podido cargar las solicitudes.')) }, [onNotify, refresh])

  const assignmentFor = (requestId: string) => assignments[requestId] ?? emptyAssignment
  const update = (requestId: string, patch: Partial<Assignment>) =>
    setAssignments((current) => ({ ...current, [requestId]: { ...assignmentFor(requestId), ...patch } }))

  async function confirm(request: TransportRequest) {
    const assignment = assignmentFor(request.id)
    if (!assignment.routeId || !assignment.pickupStopId || !assignment.deliveryStopId) return onNotify('Elige la ruta y las paradas de recogida y entrega.')
    setBusy(request.id)
    try {
      await confirmTransportRequest(request.id, assignment.routeId, assignment.pickupStopId, assignment.deliveryStopId, assignment.note)
      onNotify('Solicitud confirmada: carta creada y box asignado.')
      await refresh()
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

  const pending = requests.filter((request) => request.status === 'por_verificar')
  const rest = requests.filter((request) => request.status !== 'por_verificar')

  return <>
    <PageIntro text="Cada solicitud pagada llega aquí. Asigna una ruta y las paradas para crear la carta de porte."><Button variant="outline" onClick={() => refresh()}><RefreshCw size={15} /> Actualizar</Button></PageIntro>
    <Card className="table-card"><CardContent>
      <div className="table-heading"><div><h3>Acción necesaria</h3><p>{pending.length} solicitudes pagadas pendientes de asignar</p></div><span className="status status-por_verificar">{pending.length} pendientes</span></div>
      {pending.length === 0 ? <p className="empty-copy">No hay solicitudes pendientes de verificar.</p> : pending.map((request) => {
        const assignment = assignmentFor(request.id)
        const route = routes.find((item) => item.id === assignment.routeId)
        const stops = route?.stops ?? []
        return <div className="animal-form-card" key={request.id}>
          <div><span>{request.contactName} · {request.contactPhone}</span><span className="route-cell"><b>{request.origin}</b><ChevronRight size={14} /><b>{request.destination}</b></span></div>
          <div className="request-details"><span><b>Fecha solicitada</b>{formatDate(request.desiredDate)}</span><span><b>Mascotas</b>{request.animals.map((animal) => `${animal.species} · ${animal.weightKg} kg`).join('  ·  ')}</span><span><b>Pago</b>{request.paidAt ? `Registrado el ${new Date(request.paidAt).toLocaleDateString('es-ES')}` : 'Pendiente de confirmar'}</span>{request.notes && <span><b>Observaciones</b>{request.notes}</span>}</div>
          <div className="letter-form-grid animal-fields">
            <label>Ruta diaria<select value={assignment.routeId} onChange={(event) => update(request.id, { routeId: event.target.value, pickupStopId: '', deliveryStopId: '' })}><option value="">Selecciona una ruta</option>{routes.map((item) => <option value={item.id} key={item.id}>{formatDate(item.date)}</option>)}</select></label>
            <label>Nota para el cliente<input value={assignment.note} onChange={(event) => update(request.id, { note: event.target.value })} placeholder="Opcional" /></label>
            <label>Parada de recogida<select value={assignment.pickupStopId} onChange={(event) => update(request.id, { pickupStopId: event.target.value })} disabled={!stops.length}><option value="">Selecciona una parada</option>{stops.map((stop) => <option value={stop.id} key={stop.id}>{stop.locality}</option>)}</select></label>
            <label>Parada de entrega<select value={assignment.deliveryStopId} onChange={(event) => update(request.id, { deliveryStopId: event.target.value })} disabled={!stops.length}><option value="">Selecciona una parada</option>{stops.map((stop) => <option value={stop.id} key={stop.id}>{stop.locality}</option>)}</select></label>
          </div>
          <div className="row-actions">
            <Button type="button" disabled={busy === request.id} onClick={() => confirm(request)}>Confirmar</Button>
            <Button type="button" variant="outline" disabled={busy === request.id} onClick={() => reject(request)}>Rechazar</Button>
          </div>
        </div>
      })}
    </CardContent></Card>
    <Card className="table-card"><CardContent>
      <div className="table-heading"><div><h3>Histórico</h3><p>{rest.length} solicitudes ya gestionadas</p></div></div>
      {rest.length === 0 ? <p className="empty-copy">Todavía no hay solicitudes resueltas.</p> : <div className="responsive-table"><table>
        <thead><tr><th>Cliente</th><th>Trayecto</th><th>Mascotas</th><th>Fecha</th><th>Estado</th></tr></thead>
        <tbody>{rest.map((request) => <tr key={request.id}>
          <td><strong>{request.contactName}</strong><small>{request.contactPhone}</small></td>
          <td><span className="route-cell"><b>{request.origin}</b><ChevronRight size={14} /><b>{request.destination}</b></span></td>
          <td><span className="pet-list"><PawPrint size={15} /> {request.animals.length}</span></td>
          <td>{formatDate(request.desiredDate)}</td>
          <td><span className={`status status-${request.status}`}>{statusLabels[request.status] ?? request.status}</span></td>
        </tr>)}</tbody>
      </table></div>}
    </CardContent></Card>
    {requests.length === 0 && <p className="empty-copy"><ClipboardList size={15} /> Las solicitudes del portal de clientes aparecerán aquí.</p>}
  </>
}
