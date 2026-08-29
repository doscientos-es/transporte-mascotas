import { requireSupabase } from '@/shared/infrastructure/supabase'
import type { TransportRequest, TransportRequestAnimal, UpcomingRoute } from '@/shared/types'

type RequestRow = {
  id: string
  requester_id: string
  contact_name: string
  contact_phone: string
  contact_email: string
  origin_text: string
  destination_text: string
  desired_date: string
  daily_route_id: string | null
  notes: string
  status: TransportRequest['status']
  payment_reference: string
  paid_at: string | null
  admin_note: string
  created_at: string
  transport_request_animals: Array<{
    id: string
    ordinal: number
    species: string
    breed: string
    weight_kg: number
    length_cm: number
    height_cm: number
    width_cm: number
    size: TransportRequestAnimal['size']
  }>
}

function mapRequest(row: RequestRow): TransportRequest {
  return {
    id: row.id,
    requesterId: row.requester_id,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    origin: row.origin_text,
    destination: row.destination_text,
    desiredDate: row.desired_date,
    dailyRouteId: row.daily_route_id ?? '',
    notes: row.notes,
    status: row.status,
    paymentReference: row.payment_reference,
    paidAt: row.paid_at ?? undefined,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    animals: row.transport_request_animals.map((animal) => ({
      id: animal.id,
      ordinal: animal.ordinal,
      species: animal.species,
      breed: animal.breed,
      weightKg: animal.weight_kg,
      lengthCm: animal.length_cm,
      heightCm: animal.height_cm,
      widthCm: animal.width_cm,
      size: animal.size,
    })),
  }
}

export async function loadTransportRequests(requesterId?: string) {
  const database = requireSupabase()
  let query = database
    .from('transport_requests')
    .select('*, transport_request_animals(*)')
    .order('created_at', { ascending: false })
  if (requesterId) query = query.eq('requester_id', requesterId)
  const { data, error } = await query
  if (error) throw error
  return (data as RequestRow[]).map(mapRequest)
}

type UpcomingRouteRow = {
  id: string
  service_date: string
  route_direction: UpcomingRoute['routeDirection']
  template_name: string
  template_color: string
  localities: string[] | null
}

export async function loadUpcomingRoutes(): Promise<UpcomingRoute[]> {
  const { data, error } = await requireSupabase().rpc('list_upcoming_routes')
  if (error) throw error
  return ((data ?? []) as UpcomingRouteRow[]).map((row) => ({
    id: row.id,
    serviceDate: row.service_date,
    routeDirection: row.route_direction,
    templateName: row.template_name,
    templateColor: row.template_color,
    localities: row.localities ?? [],
  }))
}

export async function createTransportRequest(
  input: Omit<
    TransportRequest,
    'id' | 'requesterId' | 'status' | 'paymentReference' | 'createdAt' | 'adminNote' | 'paidAt'
  >,
) {
  const database = requireSupabase()
  const { animals, ...request } = input
  const { data, error } = await database.rpc('submit_transport_request', {
    p_contact_name: request.contactName,
    p_contact_phone: request.contactPhone,
    p_contact_email: request.contactEmail,
    p_daily_route_id: request.dailyRouteId,
    p_origin: request.origin,
    p_destination: request.destination,
    p_desired_date: request.desiredDate,
    p_notes: request.notes,
    p_animals: animals.map(
      ({ ordinal, species, breed, weightKg, lengthCm, heightCm, widthCm }) => ({
        ordinal,
        species,
        breed,
        weight_kg: weightKg,
        length_cm: lengthCm,
        height_cm: heightCm,
        width_cm: widthCm,
      }),
    ),
  })
  if (error) throw error
  return data as string
}

// Placeholder for the Redsys redirect: the gateway will end up calling the same
// RPC with its own operation reference.
export async function payTransportRequest(requestId: string) {
  const reference = `SIMULADO-${Date.now()}`
  const { error } = await requireSupabase().rpc('confirm_transport_request_payment', {
    p_request_id: requestId,
    p_reference: reference,
  })
  if (error) throw error
}

export async function confirmTransportRequest(
  requestId: string,
  dailyRouteId: string,
  pickupStopId: string,
  deliveryStopId: string,
  adminNote: string,
) {
  const { error } = await requireSupabase().rpc('confirm_transport_request', {
    p_request_id: requestId,
    p_daily_route_id: dailyRouteId,
    p_pickup_stop_id: pickupStopId,
    p_delivery_stop_id: deliveryStopId,
    p_admin_note: adminNote,
  })
  if (error) throw error
}

export async function rejectTransportRequest(requestId: string, adminNote: string) {
  const { error } = await requireSupabase().rpc('reject_transport_request', {
    p_request_id: requestId,
    p_admin_note: adminNote,
  })
  if (error) throw error
}
