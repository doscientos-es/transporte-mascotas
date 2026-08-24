import { supabase } from './supabase'
import type { Letter } from './types'

export async function loadLetters(): Promise<Letter[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('carriage_letters').select('id,service_date,status,sender_name,sender_phone,recipient_name,recipient_phone,origin_text,destination_text,imported_at,animals(id,species,breed,size)').order('imported_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row: any) => ({ id: row.id, sender: row.sender_name, senderPhone: row.sender_phone, recipient: row.recipient_name, recipientPhone: row.recipient_phone, origin: row.origin_text, destination: row.destination_text, route: 'Sin asignar', serviceDate: row.service_date, status: row.status === 'programada' ? 'revisada' : row.status, importedAt: new Date(row.imported_at).toLocaleString('es-ES'), animals: (row.animals ?? []).map((animal: any) => ({ id: animal.id, species: animal.species, breed: animal.breed, size: animal.size })) }))
}

export async function createManualLetter(letter: Letter, userId: string) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error: letterError } = await supabase.from('carriage_letters').insert({
    id: letter.id, original_filename: 'creada-en-backoffice.pdf', storage_path: `manual/${userId}/${letter.id.replaceAll(/[^a-zA-Z0-9]/g, '-')}.pdf`, service_date: letter.serviceDate,
    sender_name: letter.sender, sender_phone: letter.senderPhone, recipient_name: letter.recipient, recipient_phone: letter.recipientPhone,
    origin_text: letter.origin, destination_text: letter.destination, status: 'revisada', imported_by: userId,
  })
  if (letterError) throw letterError
  const { error: animalError } = await supabase.from('animals').insert(letter.animals.map((animal, index) => ({ id: animal.id, letter_id: letter.id, ordinal: index + 1, species: animal.species, breed: animal.breed, size: animal.size, size_source: 'manual' })))
  if (animalError) throw animalError
}

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
