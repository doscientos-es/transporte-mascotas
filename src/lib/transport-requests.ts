import { supabase } from './supabase'
import type { TransportRequest, TransportRequestAnimal, UpcomingRoute } from './types'

type RequestRow = {
  id: string
  requester_id: string
  contact_name: string
  contact_phone: string
  contact_email: string
  origin_text: string
  destination_text: string
  desired_date: string
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
    id: row.id, requesterId: row.requester_id, contactName: row.contact_name, contactPhone: row.contact_phone,
    contactEmail: row.contact_email, origin: row.origin_text, destination: row.destination_text,
    desiredDate: row.desired_date, notes: row.notes, status: row.status, paymentReference: row.payment_reference,
    paidAt: row.paid_at ?? undefined, adminNote: row.admin_note, createdAt: row.created_at,
    animals: row.transport_request_animals.map((animal) => ({
      id: animal.id, ordinal: animal.ordinal, species: animal.species, breed: animal.breed,
      weightKg: animal.weight_kg, lengthCm: animal.length_cm, heightCm: animal.height_cm,
      widthCm: animal.width_cm, size: animal.size,
    })),
  }
}

export async function loadTransportRequests(requesterId?: string) {
  if (!supabase) return []
  let query = supabase.from('transport_requests').select('*, transport_request_animals(*)').order('created_at', { ascending: false })
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
  if (!supabase) return []
  const { data, error } = await supabase.rpc('list_upcoming_routes')
  if (error) throw error
  return ((data ?? []) as UpcomingRouteRow[]).map((row) => ({
    id: row.id, serviceDate: row.service_date, routeDirection: row.route_direction,
    templateName: row.template_name, templateColor: row.template_color, localities: row.localities ?? [],
  }))
}

export async function createTransportRequest(input: Omit<TransportRequest, 'id' | 'requesterId' | 'status' | 'paymentReference' | 'createdAt' | 'adminNote' | 'paidAt'>, requesterId: string) {
  if (!supabase) return null
  const { animals, ...request } = input
  const { data, error } = await supabase.from('transport_requests').insert({
    requester_id: requesterId, contact_name: request.contactName, contact_phone: request.contactPhone,
    contact_email: request.contactEmail, origin_text: request.origin, destination_text: request.destination,
    desired_date: request.desiredDate, notes: request.notes, status: 'pago_pendiente',
  }).select('id').single()
  if (error) throw error
  const { error: animalsError } = await supabase.from('transport_request_animals').insert(animals.map((animal) => ({
    request_id: data.id, ordinal: animal.ordinal, species: animal.species, breed: animal.breed,
    weight_kg: animal.weightKg, length_cm: animal.lengthCm, height_cm: animal.heightCm,
    width_cm: animal.widthCm, size: animal.size ?? 'pequeno',
  })))
  if (animalsError) throw animalsError
  return data.id as string
}

// Placeholder for the Redsys redirect: the gateway will end up calling the same
// RPC with its own operation reference.
export async function payTransportRequest(requestId: string) {
  if (!supabase) return
  const reference = `SIMULADO-${Date.now()}`
  const { error } = await supabase.rpc('confirm_transport_request_payment', { p_request_id: requestId, p_reference: reference })
  if (error) throw error
}

export async function confirmTransportRequest(requestId: string, dailyRouteId: string, pickupStopId: string, deliveryStopId: string, adminNote: string) {
  if (!supabase) return
  const { error } = await supabase.rpc('confirm_transport_request', {
    p_request_id: requestId, p_daily_route_id: dailyRouteId,
    p_pickup_stop_id: pickupStopId, p_delivery_stop_id: deliveryStopId, p_admin_note: adminNote,
  })
  if (error) throw error
}

export async function rejectTransportRequest(requestId: string, adminNote: string) {
  if (!supabase) return
  const { error } = await supabase.rpc('reject_transport_request', { p_request_id: requestId, p_admin_note: adminNote })
  if (error) throw error
}
