import { supabase } from './supabase';
import type { Client, ClientInvoice, InvoiceClientInput, InvoicePayer, Letter } from './types';

type ClientRow = {
  id: string; full_name: string; nif: string; email: string; phone: string; address: string; city: string; postal_code: string; created_at: string
}

const toClient = (row: ClientRow): Client => ({
  id: row.id, fullName: row.full_name, nif: row.nif, email: row.email, phone: row.phone,
  address: row.address, city: row.city, postalCode: row.postal_code, createdAt: row.created_at,
})

export async function loadClients() {
  if (!supabase) return []
  const { data, error } = await supabase.from('clients').select('id, full_name, nif, email, phone, address, city, postal_code, created_at').order('full_name')
  if (error) throw error
  return (data as ClientRow[]).map(toClient)
}

export async function loadClientInvoices() {
  if (!supabase) return []
  const { data, error } = await supabase.from('invoice_drafts').select('id, letter_id, client_id, payer, concept, total_amount, status, created_at').eq('status', 'generado').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row): ClientInvoice => ({
    id: row.id, letterId: row.letter_id, clientId: row.client_id, payer: row.payer,
    concept: row.concept, total: Number(row.total_amount), status: 'generado', createdAt: row.created_at,
  }))
}

export async function createClient(client: Omit<Client, 'id' | 'createdAt'>) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.from('clients').insert({
    full_name: client.fullName, nif: client.nif, email: client.email, phone: client.phone,
    address: client.address, city: client.city, postal_code: client.postalCode,
  }).select('id, full_name, nif, email, phone, address, city, postal_code, created_at').single()
  if (error) throw error
  return toClient(data as ClientRow)
}

export async function updateClient(client: Client) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.from('clients').update({
    full_name: client.fullName, nif: client.nif, email: client.email, phone: client.phone,
    address: client.address, city: client.city, postal_code: client.postalCode,
  }).eq('id', client.id).select('id, full_name, nif, email, phone, address, city, postal_code, created_at').single()
  if (error) throw error
  return toClient(data as ClientRow)
}

export async function deleteClient(clientId: string) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) throw error
}

export async function persistInvoice(letter: Letter, payer: InvoicePayer, total: number, userId: string, manualClient?: InvoiceClientInput) {
  if (!supabase) return null
  const clientInput = payer === 'manual'
    ? manualClient
    : { fullName: payer === 'remitente' ? letter.sender : letter.recipient, phone: payer === 'remitente' ? letter.senderPhone : letter.recipientPhone, nif: '', email: '', address: '', city: '', postalCode: '' }
  if (!clientInput?.fullName.trim()) throw new Error('Falta el titular de la factura.')
  const { data: clientRow, error: clientError } = await supabase.from('clients').upsert({
    full_name: clientInput.fullName.trim(), nif: clientInput.nif.trim(), email: clientInput.email.trim(), phone: clientInput.phone.trim(),
    address: clientInput.address.trim(), city: clientInput.city.trim(), postal_code: clientInput.postalCode.trim(),
  }, { onConflict: 'normalized_name' }).select('id, full_name, nif, email, phone, address, city, postal_code, created_at').single()
  if (clientError) throw clientError
  const client = toClient(clientRow as ClientRow)
  const netAmount = Math.round((total / 1.21) * 100) / 100
  const { data, error } = await supabase.from('invoice_drafts').upsert({
    letter_id: letter.id, client_id: client.id, payer, client_snapshot: clientInput,
    concept: 'Servicio de transporte de mascota', net_amount: netAmount, vat_rate: 21,
    status: 'generado', created_by: userId,
  }, { onConflict: 'letter_id', ignoreDuplicates: true }).select('id, letter_id, client_id, payer, concept, total_amount, status, created_at')
  if (error) throw error
  const row = data?.[0]
  return {
    client, invoice: row ? {
      id: row.id, letterId: row.letter_id, clientId: row.client_id, payer: row.payer,
      concept: row.concept, total: Number(row.total_amount), status: 'generado' as const, createdAt: row.created_at,
    } : null
  }
}
