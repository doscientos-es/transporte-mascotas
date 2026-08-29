import { requireSupabase } from '@/shared/infrastructure/supabase'
import type { DailyRoute, InvoiceClientInput, Letter, ServiceAction } from '@/shared/types'

type LetterRow = {
  id: string
  service_date: string
  status: Letter['status']
  sender_name: string
  sender_nif: string
  sender_email: string
  sender_address: string
  sender_postal_code: string
  sender_city: string
  sender_province: string
  sender_phone: string
  recipient_name: string
  recipient_nif: string
  recipient_email: string
  recipient_address: string
  recipient_postal_code: string
  recipient_city: string
  recipient_province: string
  recipient_phone: string
  origin_text: string
  destination_text: string
  origin_point: string
  destination_point: string
  accompanying_documents: Letter['accompanyingDocuments']
  billing_payer: Letter['billingPayer']
  billing_client: unknown
  signed_at: string | null
  imported_at: string
  route_templates: Array<{ name: string }> | null
  animals: Array<{
    id: string
    species: string
    breed: string
    birth_date: string | null
    size: Letter['animals'][number]['size']
  }>
}

const emptyInvoiceClient = (): InvoiceClientInput => ({
  fullName: '',
  nif: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
})
const invoiceClientFrom = (value: unknown): InvoiceClientInput => {
  if (!value || typeof value !== 'object') return emptyInvoiceClient()
  const client = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(emptyInvoiceClient()).map((key) => [
      key,
      typeof client[key] === 'string' ? client[key] : '',
    ]),
  ) as InvoiceClientInput
}

export async function loadLetters(): Promise<Letter[]> {
  const { data, error } = await requireSupabase()
    .from('carriage_letters')
    .select(
      'id,service_date,status,sender_name,sender_nif,sender_email,sender_address,sender_postal_code,sender_city,sender_province,sender_phone,recipient_name,recipient_nif,recipient_email,recipient_address,recipient_postal_code,recipient_city,recipient_province,recipient_phone,origin_text,destination_text,origin_point,destination_point,accompanying_documents,billing_payer,billing_client,signed_at,imported_at,route_templates(name),animals(id,species,breed,birth_date,size)',
    )
    .order('imported_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as LetterRow[]).map((letter) => ({
    id: letter.id,
    sender: letter.sender_name,
    senderPhone: letter.sender_phone,
    senderEmail: letter.sender_email,
    senderNif: letter.sender_nif,
    senderAddress: letter.sender_address,
    senderPostalCode: letter.sender_postal_code,
    senderCity: letter.sender_city,
    senderProvince: letter.sender_province,
    recipient: letter.recipient_name,
    recipientPhone: letter.recipient_phone,
    recipientEmail: letter.recipient_email,
    recipientNif: letter.recipient_nif,
    recipientAddress: letter.recipient_address,
    recipientPostalCode: letter.recipient_postal_code,
    recipientCity: letter.recipient_city,
    recipientProvince: letter.recipient_province,
    origin: letter.origin_text,
    destination: letter.destination_text,
    originPoint: letter.origin_point ?? '',
    destinationPoint: letter.destination_point ?? '',
    accompanyingDocuments: letter.accompanying_documents ?? [],
    billingPayer: letter.billing_payer ?? 'remitente',
    billingClient: invoiceClientFrom(letter.billing_client),
    signedAt: letter.signed_at ?? undefined,
    route: letter.route_templates?.[0]?.name ?? 'Sin ruta',
    serviceDate: letter.service_date,
    status: letter.status,
    importedAt: new Date(letter.imported_at).toLocaleString('es-ES'),
    animals: letter.animals.map((animal) => ({ ...animal, birthDate: animal.birth_date ?? '' })),
  }))
}

export async function saveManualLetter(
  letter: Letter,
  route: DailyRoute,
  actions: ServiceAction[],
  reference: string,
  signatureConfirmed: boolean,
) {
  const { data, error } = await requireSupabase().rpc('create_manual_carriage_letter', {
    p_daily_route_id: route.id,
    p_reference: reference,
    p_sender: {
      name: letter.sender,
      nif: letter.senderNif,
      email: letter.senderEmail,
      phone: letter.senderPhone,
      address: letter.senderAddress,
      postalCode: letter.senderPostalCode,
      city: letter.senderCity,
      province: letter.senderProvince,
    },
    p_recipient: {
      name: letter.recipient,
      nif: letter.recipientNif,
      email: letter.recipientEmail,
      phone: letter.recipientPhone,
      address: letter.recipientAddress,
      postalCode: letter.recipientPostalCode,
      city: letter.recipientCity,
      province: letter.recipientProvince,
    },
    p_origin_stop: letter.origin,
    p_destination_stop: letter.destination,
    p_origin_point: letter.originPoint,
    p_destination_point: letter.destinationPoint,
    p_accompanying_documents: letter.accompanyingDocuments,
    p_billing_payer: letter.billingPayer,
    p_billing_client: letter.billingClient,
    p_signature_confirmed: signatureConfirmed,
    p_animals: letter.animals.map(({ id, species, breed, birthDate, size }) => ({
      id,
      species,
      breed,
      birth_date: birthDate,
      size,
    })),
    p_actions: actions.map((action) => ({
      id: action.id,
      animal_id: action.animalId,
      stop_id: action.stopId,
      type: action.type,
    })),
    p_box_number: actions.find((action) => action.type === 'recogida')?.box ?? null,
  })
  if (error) throw error
  return data
}

/** Persists the editable data without ever changing a letter's operational status. */
export async function updateLetter(
  letter: Letter,
  routeTemplateId: string,
  routesToClear: DailyRoute[],
  signatureConfirmed: boolean,
) {
  const database = requireSupabase()
  const { error: letterError } = await database
    .from('carriage_letters')
    .update({
      service_date: letter.serviceDate,
      default_route_template_id: routeTemplateId,
      sender_name: letter.sender,
      sender_nif: letter.senderNif,
      sender_email: letter.senderEmail,
      sender_address: letter.senderAddress,
      sender_postal_code: letter.senderPostalCode,
      sender_city: letter.senderCity,
      sender_province: letter.senderProvince,
      sender_phone: letter.senderPhone,
      recipient_name: letter.recipient,
      recipient_nif: letter.recipientNif,
      recipient_email: letter.recipientEmail,
      recipient_address: letter.recipientAddress,
      recipient_postal_code: letter.recipientPostalCode,
      recipient_city: letter.recipientCity,
      recipient_province: letter.recipientProvince,
      recipient_phone: letter.recipientPhone,
      origin_text: letter.origin,
      destination_text: letter.destination,
      origin_point: letter.originPoint,
      destination_point: letter.destinationPoint,
      accompanying_documents: letter.accompanyingDocuments,
      billing_payer: letter.billingPayer,
      billing_client: letter.billingClient,
      signed_at: signatureConfirmed ? new Date().toISOString() : undefined,
    })
    .eq('id', letter.id)
  if (letterError) throw letterError

  const routeIds = routesToClear.map((route) => route.id)
  if (routeIds.length) {
    const { error: assignmentsError } = await database
      .from('van_assignments')
      .delete()
      .in('daily_route_id', routeIds)
      .eq('letter_id', letter.id)
    if (assignmentsError) throw assignmentsError
    const { error: actionsError } = await database
      .from('route_actions')
      .delete()
      .eq('letter_id', letter.id)
    if (actionsError) throw actionsError
  }

  const animalIds = letter.animals.map((animal) => animal.id)
  const { error: animalsError } = await database.from('animals').upsert(
    letter.animals.map((animal, index) => ({
      id: animal.id,
      letter_id: letter.id,
      ordinal: index + 1,
      species: animal.species,
      breed: animal.breed,
      birth_date: animal.birthDate || null,
      size: animal.size,
      size_source: animal.breed === 'Sin clasificar' ? 'manual' : 'regla',
    })),
  )
  if (animalsError) throw animalsError
  const { error: removedAnimalsError } = await database
    .from('animals')
    .delete()
    .eq('letter_id', letter.id)
    .not('id', 'in', `(${animalIds.join(',')})`)
  if (removedAnimalsError) throw removedAnimalsError
}
