import { supabase } from './supabase'
import type { Letter } from './types'

export async function saveImportedLetter(letter: Letter, file: File, userId: string) {
  if (!supabase) return
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const storagePath = `${userId}/${Date.now()}-${safeName}`
  const { error: uploadError } = await supabase.storage.from('carriage-letters').upload(storagePath, file, { contentType: 'application/pdf', upsert: false })
  if (uploadError) throw uploadError

  const { error: letterError } = await supabase.from('carriage_letters').insert({
    id: letter.id,
    original_filename: file.name,
    storage_path: storagePath,
    service_date: letter.serviceDate,
    sender_name: letter.sender,
    sender_phone: letter.senderPhone,
    recipient_name: letter.recipient,
    recipient_phone: letter.recipientPhone,
    origin_text: letter.origin,
    destination_text: letter.destination,
    imported_by: userId,
  })
  if (letterError) {
    await supabase.storage.from('carriage-letters').remove([storagePath])
    throw letterError
  }
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
