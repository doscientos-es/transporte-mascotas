import { supabase } from './supabase';
import type { Client, ClientInvoice, InvoiceClientInput, InvoicePayer, Letter, PaymentDelivery } from './types';

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
  const { data, error } = await supabase.from('invoice_drafts').select('id, letter_id, client_id, payer, concept, total_amount, status, created_at').in('status', ['solicitud_pago', 'emitida', 'generado', 'pagada']).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row): ClientInvoice => ({
    id: row.id, letterId: row.letter_id, clientId: row.client_id, payer: row.payer,
    concept: row.concept, total: Number(row.total_amount), status: row.status === 'solicitud_pago' ? 'solicitud_pago' : 'emitida', createdAt: row.created_at,
  }))
}

export async function loadTransporterInvoices() {
  if (!supabase) return []
  const { data, error } = await supabase.from('transporter_invoices').select('id, letter_id, payer, concept, total_amount, status, created_at').in('status', ['solicitud_pago', 'emitida', 'generado', 'pagada']).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row): ClientInvoice => ({
    id: row.id, letterId: row.letter_id, clientId: '', payer: row.payer,
    concept: row.concept, total: Number(row.total_amount), status: row.status === 'solicitud_pago' ? 'solicitud_pago' : 'emitida', createdAt: row.created_at,
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

export async function persistInvoice(letter: Letter, payer: InvoicePayer, total: number, userId: string, manualClient?: InvoiceClientInput, delivery?: PaymentDelivery) {
  if (!supabase) return null
  const clientInput = payer === 'manual'
    ? manualClient
    : { fullName: payer === 'remitente' ? letter.sender : letter.recipient, phone: payer === 'remitente' ? letter.senderPhone : letter.recipientPhone, nif: '', email: '', address: '', city: '', postalCode: '' }
  if (!clientInput?.fullName.trim()) throw new Error('Falta el titular de la factura.')
  const deliveredClient = { ...clientInput, email: delivery?.email.trim() || clientInput.email.trim(), phone: delivery?.phone.trim() || clientInput.phone.trim() }
  const { data: clientRow, error: clientError } = await supabase.from('clients').upsert({
    full_name: deliveredClient.fullName.trim(), nif: deliveredClient.nif.trim(), email: deliveredClient.email.trim(), phone: deliveredClient.phone.trim(),
    address: deliveredClient.address.trim(), city: deliveredClient.city.trim(), postal_code: deliveredClient.postalCode.trim(),
  }, { onConflict: 'normalized_name' }).select('id, full_name, nif, email, phone, address, city, postal_code, created_at').single()
  if (clientError) throw clientError
  const client = toClient(clientRow as ClientRow)
  const netAmount = Math.round((total / 1.21) * 100) / 100
  const { data, error } = await supabase.from('invoice_drafts').upsert({
    letter_id: letter.id, client_id: client.id, payer, client_snapshot: deliveredClient,
    concept: 'Servicio de transporte de mascota', net_amount: netAmount, vat_rate: 21,
    status: 'solicitud_pago', delivery_channel: delivery?.channel ?? 'email', delivery_email: delivery?.email.trim() ?? '', delivery_phone: delivery?.phone.trim() ?? '', created_by: userId,
  }, { onConflict: 'letter_id', ignoreDuplicates: true }).select('id, letter_id, client_id, payer, concept, total_amount, status, created_at')
  if (error) throw error
  const row = data?.[0]
  return {
    client, invoice: row ? {
      id: row.id, letterId: row.letter_id, clientId: row.client_id, payer: row.payer,
      concept: row.concept, total: Number(row.total_amount), status: row.status === 'solicitud_pago' ? 'solicitud_pago' as const : 'emitida' as const, createdAt: row.created_at,
    } : null
  }
}
