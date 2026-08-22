import { supabase } from './supabase'
import type { Letter } from './types'

export async function saveManualLetter(letter: Letter, routeTemplateId: string, userId: string) {
  if (!supabase) return
  const { error: letterError } = await supabase.from('carriage_letters').insert({
    id: letter.id,
    service_date: letter.serviceDate,
    default_route_template_id: routeTemplateId,
    sender_name: letter.sender,
    sender_phone: letter.senderPhone,
    recipient_name: letter.recipient,
    recipient_phone: letter.recipientPhone,
    origin_text: letter.origin,
    destination_text: letter.destination,
    entry_source: 'manual',
    imported_by: userId,
  })
  if (letterError) throw letterError
  const { error: animalsError } = await supabase.from('animals').insert(letter.animals.map((animal, index) => ({
    id: animal.id,
    letter_id: letter.id,
    ordinal: index + 1,
    species: animal.species,
    breed: animal.breed,
    size: animal.size,
    size_source: animal.breed === 'Sin clasificar' ? 'manual' : 'regla',
  })))
  if (animalsError) throw animalsError
}
