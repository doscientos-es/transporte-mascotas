import { supabase } from './supabase';
import type { Client, ClientInvoice, InvoiceClientInput, InvoiceFiscalSnapshot, InvoicePayer, IssuedInvoice, Letter, ManualPaymentMethod, PaymentDelivery } from './types';

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
  const { data, error } = await supabase.from('invoice_drafts').select('id, letter_id, client_id, payer, client_snapshot, concept, total_amount, status, created_at, issued_invoices(id, series, fiscal_year, sequence_number, issued_at, fiscal_snapshot)').in('status', ['solicitud_pago', 'emitida']).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row): ClientInvoice => ({
    id: row.id, letterId: row.letter_id, clientId: row.client_id, payer: row.payer,
    concept: row.concept, total: Number(row.total_amount), status: row.status === 'solicitud_pago' ? 'solicitud_pago' : 'emitida', createdAt: row.created_at,
    clientName: snapshotClientName(row.client_snapshot), issuedInvoice: toIssuedInvoice(row.issued_invoices),
  }))
}

export async function loadTransporterInvoices() {
  if (!supabase) return []
  const { data, error } = await supabase.from('transporter_invoices').select('id, letter_id, payer, concept, total_amount, status, created_at').in('status', ['solicitud_pago', 'emitida', 'generado', 'pagada']).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row): ClientInvoice => ({
    id: row.id, letterId: row.letter_id, clientId: '', payer: row.payer,
    concept: row.concept, total: Number(row.total_amount), status: row.status === 'solicitud_pago' ? 'solicitud_pago' : 'emitida', createdAt: row.created_at,
    clientName: '',
  }))
}

function snapshotClientName(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') return ''
  const fullName = (snapshot as Record<string, unknown>).fullName
  return typeof fullName === 'string' ? fullName : ''
}

function toIssuedInvoice(value: unknown): IssuedInvoice | undefined {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return undefined
  const invoice = row as Record<string, unknown>
  if (typeof invoice.id !== 'string' || typeof invoice.issued_at !== 'string') return undefined
  const number = typeof (invoice.fiscal_snapshot as Record<string, unknown> | null)?.number === 'string'
    ? (invoice.fiscal_snapshot as Record<string, unknown>).number as string
    : `${invoice.series}-${invoice.fiscal_year}-${String(invoice.sequence_number).padStart(6, '0')}`
  return { id: invoice.id, number, issuedAt: invoice.issued_at, fiscalSnapshot: (invoice.fiscal_snapshot ?? {}) as InvoiceFiscalSnapshot }
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

function fiscalClient(client: InvoiceClientInput) {
  const normalized = Object.fromEntries(Object.entries(client).map(([key, value]) => [key, value.trim()])) as InvoiceClientInput
  const required = [['nombre o razón social', normalized.fullName], ['NIF/CIF', normalized.nif], ['dirección', normalized.address], ['código postal', normalized.postalCode], ['ciudad', normalized.city]]
  const missing = required.filter(([, value]) => !value).map(([label]) => label)
  if (missing.length) throw new Error(`Completa los datos fiscales: ${missing.join(', ')}.`)
  return normalized
}

function invoiceAmounts(total: number) {
  const totalCents = Math.round(total * 100)
  if (!Number.isFinite(total) || totalCents <= 0 || totalCents > 99_999_999 || Math.abs(total * 100 - totalCents) > 0.000001) throw new Error('El total debe ser un importe positivo con un máximo de dos decimales.')
  const netCents = Math.round(totalCents / 1.21)
  return { netAmount: netCents / 100, vatAmount: (totalCents - netCents) / 100, totalAmount: totalCents / 100 }
}

export async function persistInvoice(letter: Letter, payer: InvoicePayer, total: number, userId: string, clientInput: InvoiceClientInput, delivery?: PaymentDelivery) {
  if (!supabase) return null
  const fiscalData = fiscalClient(clientInput)
  const deliveredClient = { ...fiscalData, email: delivery?.email.trim() || fiscalData.email, phone: delivery?.phone.trim() || fiscalData.phone }
  const amounts = invoiceAmounts(total)
  const { data: clientRow, error: clientError } = await supabase.from('clients').upsert({
    full_name: deliveredClient.fullName.trim(), nif: deliveredClient.nif.trim(), email: deliveredClient.email.trim(), phone: deliveredClient.phone.trim(),
    address: deliveredClient.address.trim(), city: deliveredClient.city.trim(), postal_code: deliveredClient.postalCode.trim(),
  }, { onConflict: 'normalized_name' }).select('id, full_name, nif, email, phone, address, city, postal_code, created_at').single()
  if (clientError) throw clientError
  const client = toClient(clientRow as ClientRow)
  const { data, error } = await supabase.from('invoice_drafts').upsert({
    letter_id: letter.id, client_id: client.id, payer, client_snapshot: deliveredClient,
    concept: 'Servicio de transporte de mascota', net_amount: amounts.netAmount, vat_amount: amounts.vatAmount, total_amount: amounts.totalAmount, vat_rate: 21,
    status: 'solicitud_pago', delivery_channel: delivery?.channel ?? 'email', delivery_email: delivery?.email.trim() ?? '', delivery_phone: delivery?.phone.trim() ?? '', created_by: userId,
  }, { onConflict: 'letter_id' }).select('id, letter_id, client_id, payer, concept, total_amount, status, created_at')
  if (error) throw error
  const row = data?.[0]
  return {
    client, invoice: row ? {
      id: row.id, letterId: row.letter_id, clientId: row.client_id, payer: row.payer,
      concept: row.concept, total: Number(row.total_amount), status: row.status === 'solicitud_pago' ? 'solicitud_pago' as const : 'emitida' as const, createdAt: row.created_at, clientName: client.fullName,
    } : null
  }
}

export async function confirmManualInvoicePayment(invoiceId: string, paymentMethod: ManualPaymentMethod) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.functions.invoke('confirm-manual-invoice-payment', { body: { invoiceId, paymentMethod } })
  if (error) throw new Error('No se ha podido registrar el cobro manual.')
  const result = data as { error?: string } | null
  if (result?.error) throw new Error(result.error)
}
