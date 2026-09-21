import { requireSupabase } from '@/shared/infrastructure/supabase'
import type {
  ClientPet,
  TransportRequest,
  TransportRequestAnimal,
  TransportBoxCategory,
  UpcomingRoute,
} from '@/shared/types'

import { throwRequestError } from './request-errors'

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
  origin_latitude: number | null
  origin_longitude: number | null
  destination_latitude: number | null
  destination_longitude: number | null
  notes: string
  status: TransportRequest['status']
  amount_cents: number
  payment_reference: string
  paid_at: string | null
  admin_note: string
  created_at: string
  transport_request_animals: Array<{
    id: string
    name: string
    ordinal: number
    species: string
    breed: string
    weight_kg: number
    length_cm: number
    height_cm: number
    width_cm: number
    size: TransportRequestAnimal['size']
    minimum_box_category: TransportRequestAnimal['minimumBoxCategory']
    requested_box_category: TransportBoxCategory
    assigned_box_category: TransportBoxCategory
    client_pet_id: string | null
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
    originLatitude: row.origin_latitude ?? undefined,
    originLongitude: row.origin_longitude ?? undefined,
    destinationLatitude: row.destination_latitude ?? undefined,
    destinationLongitude: row.destination_longitude ?? undefined,
    notes: row.notes,
    status: row.status,
    amountCents: row.amount_cents,
    paymentReference: row.payment_reference,
    paidAt: row.paid_at ?? undefined,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    animals: row.transport_request_animals.map((animal) => ({
      id: animal.id,
      name: animal.name,
      ordinal: animal.ordinal,
      species: animal.species,
      breed: animal.breed,
      weightKg: animal.weight_kg,
      lengthCm: animal.length_cm,
      heightCm: animal.height_cm,
      widthCm: animal.width_cm,
      size: animal.size,
      minimumBoxCategory: animal.minimum_box_category,
      requestedBoxCategory: animal.requested_box_category,
      assignedBoxCategory: animal.assigned_box_category,
      clientPetId: animal.client_pet_id ?? undefined,
    })),
  }
}

type ClientPetRow = {
  id: string
  name: string
  species: string
  breed: string
  weight_kg: number
  length_cm: number
  height_cm: number
  width_cm: number
}

const mapClientPet = (pet: ClientPetRow): ClientPet => ({
  id: pet.id,
  name: pet.name,
  species: pet.species,
  breed: pet.breed,
  weightKg: pet.weight_kg,
  lengthCm: pet.length_cm,
  heightCm: pet.height_cm,
  widthCm: pet.width_cm,
})

export async function loadClientPets(): Promise<ClientPet[]> {
  const { data, error } = await requireSupabase()
    .from('client_pets')
    .select('id, name, species, breed, weight_kg, length_cm, height_cm, width_cm')
    .order('name')
  if (error) throwRequestError(error, 'No se han podido cargar tus mascotas guardadas.')
  return ((data ?? []) as ClientPetRow[]).map(mapClientPet)
}

export async function saveClientPets(animals: TransportRequestAnimal[]) {
  const { error } = await requireSupabase().rpc('save_client_pets', {
    p_pets: animals.map(({ name, species, breed, weightKg, lengthCm, heightCm, widthCm }) => ({
      name,
      species,
      breed,
      weight_kg: weightKg,
      length_cm: lengthCm,
      height_cm: heightCm,
      width_cm: widthCm,
    })),
  })
  if (error) throwRequestError(error, 'No se han podido guardar las mascotas. Vuelve a intentarlo.')
}

export async function loadTransportRequests(requesterId?: string) {
  const database = requireSupabase()
  let query = database
    .from('transport_requests')
    .select('*, transport_request_animals(*)')
    .order('created_at', { ascending: false })
  if (requesterId) query = query.eq('requester_id', requesterId)
  const { data, error } = await query
  if (error) throwRequestError(error, 'No se han podido cargar las solicitudes de transporte.')
  return ((data ?? []) as RequestRow[]).map(mapRequest)
}

type UpcomingRouteRow = {
  id: string
  service_date: string
  route_direction: UpcomingRoute['routeDirection']
  template_name: string
  template_color: string
  localities: string[] | null
  stops: UpcomingRoute['stops'] | null
}

export async function loadUpcomingRoutes(): Promise<UpcomingRoute[]> {
  const { data, error } = await requireSupabase().rpc('list_upcoming_routes')
  if (error) throwRequestError(error, 'No se han podido cargar las próximas salidas.')
  return ((data ?? []) as UpcomingRouteRow[]).map((row) => ({
    id: row.id,
    serviceDate: row.service_date,
    routeDirection: row.route_direction,
    templateName: row.template_name,
    templateColor: row.template_color,
    localities: row.localities ?? [],
    stops: row.stops ?? [],
  }))
}

export async function createTransportRequest(
  input: Omit<
    TransportRequest,
    | 'id'
    | 'requesterId'
    | 'status'
    | 'amountCents'
    | 'paymentReference'
    | 'createdAt'
    | 'adminNote'
    | 'paidAt'
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
      ({
        ordinal,
        name,
        species,
        breed,
        weightKg,
        lengthCm,
        heightCm,
        widthCm,
        requestedBoxCategory,
        clientPetId,
      }) => ({
        ordinal,
        name,
        species,
        breed,
        weight_kg: weightKg,
        length_cm: lengthCm,
        height_cm: heightCm,
        width_cm: widthCm,
        requested_box_category: requestedBoxCategory ?? 'pequeno',
        client_pet_id: clientPetId ?? null,
      }),
    ),
  })
  if (error)
    throwRequestError(
      error,
      'No se ha podido enviar la solicitud. Comprueba tu conexión y vuelve a intentarlo.',
    )
  return data as string
}

export async function payTransportRequest(requestId: string) {
  const { data, error } = await requireSupabase().functions.invoke('transport-payment', {
    body: { requestId },
  })
  if (error) throw new Error('No se ha podido preparar el pago. Vuelve a intentarlo.')
  const result = data as { paymentUrl?: string; error?: string } | null
  if (result?.error) throw new Error(result.error)
  if (!result?.paymentUrl) throw new Error('No se ha recibido el enlace de pago.')
  return result.paymentUrl
}

export async function confirmTransportRequest(
  requestId: string,
  dailyRouteId: string,
  pickupStopId: string,
  deliveryStopId: string,
  adminNote: string,
) {
  const database = requireSupabase()
  const { error } = await database.rpc('confirm_transport_request', {
    p_request_id: requestId,
    p_daily_route_id: dailyRouteId,
    p_pickup_stop_id: pickupStopId,
    p_delivery_stop_id: deliveryStopId,
    p_admin_note: adminNote,
  })
  if (error)
    throwRequestError(error, 'No se ha podido confirmar la solicitud. Vuelve a intentarlo.')
}

export async function rejectTransportRequest(requestId: string, adminNote: string) {
  const { error } = await requireSupabase().rpc('reject_transport_request', {
    p_request_id: requestId,
    p_admin_note: adminNote,
  })
  if (error) throwRequestError(error, 'No se ha podido rechazar la solicitud. Vuelve a intentarlo.')
}

export async function updateTransportRequestAnimalBox(
  animalId: string,
  category: TransportBoxCategory,
) {
  const { error } = await requireSupabase().rpc('update_transport_request_animal_box', {
    p_animal_id: animalId,
    p_category: category,
  })
  if (error) throwRequestError(error, 'No se ha podido cambiar la categoría del box.')
}
