import { requireSupabase } from '@/shared/infrastructure/supabase'
import type {
  AccompanyingDocument,
  TransportRequest,
  TransportRequestAnimal,
  TransportPaymentAttemptStatus,
  TransportBoxCategory,
  UpcomingRoute,
  RouteStop,
} from '@/shared/types'

import { throwRequestError } from './request-errors'

type RequestRow = {
  id: string
  requester_id: string
  contact_name: string
  contact_phone: string
  contact_email: string
  sender_nif: string
  sender_address: string
  sender_postal_code: string
  sender_city: string
  sender_province: string
  recipient_name: string
  recipient_nif: string
  recipient_phone: string
  recipient_email: string
  recipient_address: string
  recipient_postal_code: string
  recipient_city: string
  recipient_province: string
  billing_payer: TransportRequest['billingPayer']
  billing_client: TransportRequest['billingClient']
  origin_text: string
  destination_text: string
  desired_date: string
  daily_route_id: string | null
  origin_latitude: number | null
  origin_longitude: number | null
  destination_latitude: number | null
  destination_longitude: number | null
  accompanying_documents: AccompanyingDocument[] | null
  notes: string
  status: TransportRequest['status']
  payment_attempt_status: TransportPaymentAttemptStatus
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
    birth_date: string | null
    weight_kg: number
    length_cm: number
    height_cm: number
    width_cm: number
    size: TransportRequestAnimal['size']
    minimum_box_category: TransportRequestAnimal['minimumBoxCategory']
    requested_box_category: TransportBoxCategory
    assigned_box_category: TransportBoxCategory
    shared_box_group: string | null
  }>
}

export type TransportPaymentForm = {
  endpoint: string
  fields: Record<string, string>
}

function mapRequest(row: RequestRow): TransportRequest {
  return {
    id: row.id,
    requesterId: row.requester_id,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    senderNif: row.sender_nif,
    senderAddress: row.sender_address,
    senderPostalCode: row.sender_postal_code,
    senderCity: row.sender_city,
    senderProvince: row.sender_province,
    recipientName: row.recipient_name,
    recipientNif: row.recipient_nif,
    recipientPhone: row.recipient_phone,
    recipientEmail: row.recipient_email,
    recipientAddress: row.recipient_address,
    recipientPostalCode: row.recipient_postal_code,
    recipientCity: row.recipient_city,
    recipientProvince: row.recipient_province,
    billingPayer: row.billing_payer,
    billingClient: row.billing_client,
    origin: row.origin_text,
    destination: row.destination_text,
    desiredDate: row.desired_date,
    dailyRouteId: row.daily_route_id ?? '',
    originLatitude: row.origin_latitude ?? undefined,
    originLongitude: row.origin_longitude ?? undefined,
    destinationLatitude: row.destination_latitude ?? undefined,
    destinationLongitude: row.destination_longitude ?? undefined,
    accompanyingDocuments: row.accompanying_documents ?? [],
    notes: row.notes,
    status: row.status,
    paymentAttemptStatus: row.payment_attempt_status,
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
      birthDate: animal.birth_date ?? '',
      weightKg: animal.weight_kg,
      lengthCm: animal.length_cm,
      heightCm: animal.height_cm,
      widthCm: animal.width_cm,
      size: animal.size,
      minimumBoxCategory: animal.minimum_box_category,
      requestedBoxCategory: animal.requested_box_category,
      assignedBoxCategory: animal.assigned_box_category,
      sharedBoxGroup: animal.shared_box_group ?? undefined,
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
  if (error) throwRequestError(error, 'No se han podido cargar las solicitudes de transporte.')
  return ((data ?? []) as RequestRow[]).map(mapRequest)
}

type UpcomingRouteRow = {
  id: string
  service_date: string
  start_time?: string | null
  route_direction: UpcomingRoute['routeDirection']
  template_name: string
  template_color: string
  localities: string[] | null
  stops: UpcomingRoute['stops'] | null
  end_date?: string | null
}

export async function loadUpcomingRoutes(): Promise<UpcomingRoute[]> {
  const { data, error } = await requireSupabase().rpc('list_upcoming_routes')
  if (error) throwRequestError(error, 'No se han podido cargar las próximas salidas.')
  return ((data ?? []) as UpcomingRouteRow[]).map((row) => ({
    id: row.id,
    serviceDate: row.service_date,
    startTime: row.start_time?.slice(0, 5),
    endDate: row.end_date ?? row.service_date,
    routeDirection: row.route_direction,
    templateName: row.template_name,
    templateColor: row.template_color,
    localities: row.localities ?? [],
    stops: row.stops ?? [],
  }))
}

type PublicUpcomingRouteRow = Omit<UpcomingRouteRow, 'stops'> & {
  stops: Array<
    Pick<RouteStop, 'id' | 'locality' | 'latitude' | 'longitude' | 'minutes' | 'dwellMinutes'>
  > | null
}

export async function loadPublicUpcomingRoutes(): Promise<UpcomingRoute[]> {
  const { data, error } = await requireSupabase().rpc('list_public_transport_routes')
  if (error) throwRequestError(error, 'No se han podido cargar las próximas salidas.')
  return ((data ?? []) as PublicUpcomingRouteRow[]).map((row) => ({
    id: row.id,
    serviceDate: row.service_date,
    startTime: row.start_time?.slice(0, 5),
    endDate: row.end_date ?? row.service_date,
    routeDirection: row.route_direction,
    templateName: row.template_name,
    templateColor: row.template_color,
    localities: row.localities ?? [],
    stops: (row.stops ?? []).map((stop) => ({
      ...stop,
      place: '',
      mapUrl: '',
    })),
  }))
}

export type CreateTransportRequestInput = Omit<
  TransportRequest,
  | 'id'
  | 'requesterId'
  | 'status'
  | 'amountCents'
  | 'paymentReference'
  | 'createdAt'
  | 'adminNote'
  | 'paidAt'
>

export function transportRequestRpcArgs(input: CreateTransportRequestInput) {
  const { animals, ...request } = input
  return {
    p_contact_name: request.contactName,
    p_contact_phone: request.contactPhone,
    p_contact_email: request.contactEmail,
    p_sender_nif: request.senderNif,
    p_sender_address: request.senderAddress,
    p_sender_postal_code: request.senderPostalCode,
    p_sender_city: request.senderCity,
    p_sender_province: request.senderProvince,
    p_recipient_name: request.recipientName,
    p_recipient_nif: request.recipientNif,
    p_recipient_phone: request.recipientPhone,
    p_recipient_email: request.recipientEmail,
    p_recipient_address: request.recipientAddress,
    p_recipient_postal_code: request.recipientPostalCode,
    p_recipient_city: request.recipientCity,
    p_recipient_province: request.recipientProvince,
    p_billing_payer: request.billingPayer,
    p_billing_client: request.billingClient,
    p_daily_route_id: request.dailyRouteId,
    p_origin: request.origin,
    p_destination: request.destination,
    p_desired_date: request.desiredDate,
    p_notes: request.notes,
    p_accompanying_documents: request.accompanyingDocuments,
    p_animals: animals.map(
      ({
        ordinal,
        name,
        species,
        breed,
        birthDate,
        weightKg,
        lengthCm,
        heightCm,
        widthCm,
        requestedBoxCategory,
      }) => ({
        ordinal,
        name,
        species,
        breed,
        birth_date: birthDate,
        weight_kg: weightKg,
        length_cm: lengthCm,
        height_cm: heightCm,
        width_cm: widthCm,
        requested_box_category: requestedBoxCategory ?? 'pequeno',
      }),
    ),
  }
}

export async function createTransportRequest(input: CreateTransportRequestInput) {
  const database = requireSupabase()
  const { data, error } = await database.rpc(
    'submit_transport_request',
    transportRequestRpcArgs(input),
  )
  if (error)
    throwRequestError(
      error,
      'No se ha podido enviar la solicitud. Comprueba tu conexión y vuelve a intentarlo.',
    )
  return data as string
}

export async function createAdminTransportRequest(input: CreateTransportRequestInput) {
  const database = requireSupabase()
  const { data, error } = await database.rpc(
    'submit_transport_request_admin',
    transportRequestRpcArgs(input),
  )
  if (error)
    throwRequestError(
      error,
      'No se ha podido crear la solicitud manual. Comprueba los datos y vuelve a intentarlo.',
    )
  return data as string
}

export async function payTransportRequest(requestId: string) {
  const { data, error } = await requireSupabase().functions.invoke('transport-payment', {
    body: { requestId },
  })
  if (error)
    throw new Error(await functionErrorMessage(error, 'No se ha podido preparar el pago.'))
  const result = data as { paymentUrl?: string; error?: string } | null
  if (result?.error) throw new Error(result.error)
  return openPaymentForm(result?.paymentUrl)
}

export type ClientPaymentRequest = {
  id: string
  letterId: string
  concept: string
  totalAmount: number
  createdAt: string
}

export async function loadMyPaymentRequests() {
  const { data, error } = await requireSupabase().rpc('list_my_payment_requests')
  if (error) throw error
  return (data ?? []).map(
    (row: {
      id: string
      letter_id: string
      concept: string
      total_amount: number | string
      created_at: string
    }): ClientPaymentRequest => ({
      id: row.id,
      letterId: row.letter_id,
      concept: row.concept,
      totalAmount: Number(row.total_amount),
      createdAt: row.created_at,
    }),
  )
}

export async function payClientPaymentRequest(invoiceId: string) {
  const { data, error } = await requireSupabase().functions.invoke('client-payment-request', {
    body: { invoiceId },
  })
  if (error) throw new Error(await functionErrorMessage(error, 'No se ha podido preparar el pago.'))
  const result = data as { paymentUrl?: string; error?: string } | null
  if (result?.error) throw new Error(result.error)
  return openPaymentForm(result?.paymentUrl)
}

async function openPaymentForm(url: string | undefined) {
  if (!url) throw new Error('No se ha recibido el enlace de pago.')
  const paymentUrl = new URL(url)
  paymentUrl.searchParams.set('format', 'json')
  const paymentResponse = await fetch(paymentUrl)
  if (!paymentResponse.ok) throw new Error('No se ha podido abrir la pasarela de pago.')
  const paymentForm = (await paymentResponse.json()) as Partial<TransportPaymentForm>
  if (
    typeof paymentForm.endpoint !== 'string' ||
    !paymentForm.fields ||
    typeof paymentForm.fields !== 'object'
  )
    throw new Error('La pasarela de pago no ha devuelto un formulario válido.')
  return paymentForm as TransportPaymentForm
}

async function functionErrorMessage(error: unknown, fallback: string) {
  const context =
    error && typeof error === 'object' && 'context' in error ? error.context : undefined
  if (context instanceof Response) {
    const details = (await context.json().catch(() => null)) as { error?: string } | null
    if (details?.error) return details.error
  }
  return fallback
}

export async function loadTransportInvoice(requestId: string) {
  const database = requireSupabase()
  const { data, error } = await database.functions.invoke('invoice-pdf', { body: { requestId } })
  if (error)
    throw new Error(await functionErrorMessage(error, 'No se ha podido obtener la factura.'))
  const { url, fileName } = (data as { url?: string; fileName?: string } | null) ?? {}
  const token = url ? new URL(url).searchParams.get('token') : null
  if (!token) throw new Error('La factura no ha devuelto un enlace de descarga.')
  const { data: file, error: fileError } = await database.functions.invoke(
    `invoice-pdf?token=${encodeURIComponent(token)}`,
    { method: 'GET' },
  )
  if (fileError || !(file instanceof Blob)) throw new Error('No se ha podido descargar la factura.')
  return { file, fileName: fileName || 'factura.pdf' }
}

export type TransportCarriageLetter = {
  id: string
  service_date: string
  sender_name: string
  sender_nif: string
  sender_phone: string
  sender_email: string
  sender_address: string
  sender_postal_code: string
  sender_city: string
  sender_province: string
  recipient_name: string
  recipient_nif: string
  recipient_phone: string
  recipient_email: string
  recipient_address: string
  recipient_postal_code: string
  recipient_city: string
  recipient_province: string
  origin_text: string
  destination_text: string
  origin_point: string
  destination_point: string
  accompanying_documents: string[] | null
  transport_box_number?: number | null
  animals: Array<{
    ordinal: number
    species: string
    breed: string
    identification: string
    birth_date: string | null
    weight_kg: number | null
    length_cm: number | null
    height_cm: number | null
    width_cm: number | null
    /** Pets with the same number travel in one box. */
    shared_box?: number | null
  }>
}

export async function loadTransportCarriageLetter(requestId: string) {
  const { data, error } = await requireSupabase().rpc('get_transport_request_carriage_letter', {
    p_request_id: requestId,
  })
  if (error) throwRequestError(error, 'No se ha podido obtener la carta de porte.')
  if (!data) throw new Error('La carta de porte todavía no está disponible.')
  return data as TransportCarriageLetter
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

/** Puts the animal in the same box as `partnerAnimalId`, or in its own box when null. */
export async function setTransportRequestAnimalSharedBox(
  animalId: string,
  partnerAnimalId: string | null,
) {
  const { error } = await requireSupabase().rpc('set_transport_request_animal_shared_box', {
    p_animal_id: animalId,
    p_partner_animal_id: partnerAnimalId,
  })
  if (error) throwRequestError(error, 'No se ha podido compartir el box.')
}
