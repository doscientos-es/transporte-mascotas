import { supabase } from './supabase'
import type { DailyRoute, Letter } from './types'

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

/** Persists the editable data without ever changing a letter's operational status. */
export async function updateLetter(letter: Letter, routeTemplateId: string, routesToClear: DailyRoute[]) {
  if (!supabase) return
  const database = supabase
  const { error: letterError } = await database.from('carriage_letters').update({
    service_date: letter.serviceDate,
    default_route_template_id: routeTemplateId,
    sender_name: letter.sender,
    sender_phone: letter.senderPhone,
    recipient_name: letter.recipient,
    recipient_phone: letter.recipientPhone,
    origin_text: letter.origin,
    destination_text: letter.destination,
  }).eq('id', letter.id)
  if (letterError) throw letterError

  const routeIds = routesToClear.map((route) => route.id)
  if (routeIds.length) {
    const { error: assignmentsError } = await database.from('van_assignments').delete().in('daily_route_id', routeIds).eq('letter_id', letter.id)
    if (assignmentsError) throw assignmentsError
    const { error: actionsError } = await database.from('route_actions').delete().eq('letter_id', letter.id)
    if (actionsError) throw actionsError
  }

  const animalIds = letter.animals.map((animal) => animal.id)
  const { error: animalsError } = await database.from('animals').upsert(letter.animals.map((animal, index) => ({
    id: animal.id,
    letter_id: letter.id,
    ordinal: index + 1,
    species: animal.species,
    breed: animal.breed,
    size: animal.size,
    size_source: animal.breed === 'Sin clasificar' ? 'manual' : 'regla',
  })))
  if (animalsError) throw animalsError
  const { error: removedAnimalsError } = await database.from('animals').delete().eq('letter_id', letter.id).not('id', 'in', `(${animalIds.join(',')})`)
  if (removedAnimalsError) throw removedAnimalsError

}
