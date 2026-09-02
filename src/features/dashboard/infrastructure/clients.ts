import { requireSupabase, supabase } from '@/shared/infrastructure/supabase'
import type {
  Client,
  ClientInvoice,
  InvoiceClientInput,
  InvoiceFiscalSnapshot,
  InvoicePayer,
  Letter,
  ManualPaymentMethod,
  PaginatedResult,
  PaymentDelivery,
} from '@/shared/types'

type ClientRow = {
  id: string
  full_name: string
  nif: string
  email: string
  phone: string
  address: string
  city: string
  postal_code: string
  created_at: string
}

const toClient = (row: ClientRow): Client => ({
  id: row.id,
  fullName: row.full_name,
  nif: row.nif,
  email: row.email,
  phone: row.phone,
  address: row.address,
  city: row.city,
  postalCode: row.postal_code,
  createdAt: row.created_at,
})

export const CLIENT_LIST_PAGE_SIZE = 12
export const INVOICE_LIST_PAGE_SIZE = 12
export const clientSortOptions = ['name', 'city', 'created_at'] as const
export const invoiceSortOptions = ['date', 'total', 'client', 'status'] as const

export type ClientSort = (typeof clientSortOptions)[number]
export type InvoiceSort = (typeof invoiceSortOptions)[number]
export type SortDirection = 'asc' | 'desc'

type ClientPageOptions = {
  query: string
  sort: ClientSort
  direction: SortDirection
  page: number
}

type InvoicePageOptions = {
  query: string
  status?: 'solicitud_pago' | 'emitida'
  clientId?: string
  from?: string
  to?: string
  sort: InvoiceSort
  direction: SortDirection
  page: number
  pageSize?: number
}

type InvoiceRow = {
  id: string
  letter_id: string
  client_id: string | null
  payer: InvoicePayer
  concept: string
  total_amount: number | string
  status: string
  created_at: string
  client_name: string | null
  client_nif: string | null
  issued_invoice_id: string | null
  issued_number: string | null
  issued_at: string | null
  fiscal_snapshot: InvoiceFiscalSnapshot | null
}

type PagePayload = { items?: unknown; total?: unknown }

function pageFrom<Row, Item>(value: unknown, mapper: (row: Row) => Item): PaginatedResult<Item> {
  const page = value as PagePayload | null
  const items = Array.isArray(page?.items) ? page.items : []
  return {
    items: items.map((item) => mapper(item as Row)),
    total: typeof page?.total === 'number' ? page.total : 0,
  }
}

function toInvoice(row: InvoiceRow): ClientInvoice {
  const issuedInvoice =
    row.issued_invoice_id && row.issued_number && row.issued_at
      ? {
          id: row.issued_invoice_id,
          invoiceDraftId: row.id,
          number: row.issued_number,
          issuedAt: row.issued_at,
          fiscalSnapshot: row.fiscal_snapshot ?? {},
        }
      : undefined
  return {
    id: row.id,
    letterId: row.letter_id,
    clientId: row.client_id ?? '',
    payer: row.payer,
    concept: row.concept,
    total: Number(row.total_amount),
    status: row.status === 'solicitud_pago' ? 'solicitud_pago' : 'emitida',
    createdAt: row.created_at,
    clientName: row.client_name ?? '',
    clientNif: row.client_nif ?? '',
    issuedInvoice,
  }
}

export async function loadClientPage(options: ClientPageOptions): Promise<PaginatedResult<Client>> {
  const { data, error } = await requireSupabase().rpc('list_client_page', {
    p_query: options.query || null,
    p_sort: options.sort,
    p_direction: options.direction,
    p_page: options.page,
    p_page_size: CLIENT_LIST_PAGE_SIZE,
  })
  if (error) throw error
  return pageFrom<ClientRow, Client>(data, toClient)
}

export async function loadClientById(clientId: string): Promise<Client | null> {
  const { data, error } = await requireSupabase()
    .from('clients')
    .select('id, full_name, nif, email, phone, address, city, postal_code, created_at')
    .eq('id', clientId)
    .maybeSingle()
  if (error) throw error
  return data ? toClient(data as ClientRow) : null
}

export async function loadInvoicePage(
  options: InvoicePageOptions,
): Promise<PaginatedResult<ClientInvoice>> {
  const { data, error } = await requireSupabase().rpc('list_invoice_page', {
    p_query: options.query || null,
    p_status: options.status ?? null,
    p_client_id: options.clientId ?? null,
    p_from: options.from || null,
    p_to: options.to || null,
    p_sort: options.sort,
    p_direction: options.direction,
    p_page: options.page,
    p_page_size: options.pageSize ?? INVOICE_LIST_PAGE_SIZE,
  })
  if (error) throw error
  return pageFrom<InvoiceRow, ClientInvoice>(data, toInvoice)
}

export async function createClient(client: Omit<Client, 'id' | 'createdAt'>) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase
    .from('clients')
    .insert({
      full_name: client.fullName,
      nif: client.nif,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      postal_code: client.postalCode,
    })
    .select('id, full_name, nif, email, phone, address, city, postal_code, created_at')
    .single()
  if (error) throw error
  return toClient(data as ClientRow)
}

export async function updateClient(client: Client) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase
    .from('clients')
    .update({
      full_name: client.fullName,
      nif: client.nif,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      postal_code: client.postalCode,
    })
    .eq('id', client.id)
    .select('id, full_name, nif, email, phone, address, city, postal_code, created_at')
    .single()
  if (error) throw error
  return toClient(data as ClientRow)
}

export async function deleteClient(clientId: string) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) throw error
}

function fiscalClient(client: InvoiceClientInput) {
  const normalized = Object.fromEntries(
    Object.entries(client).map(([key, value]) => [key, value.trim()]),
  ) as InvoiceClientInput
  const required = [
    ['nombre o razón social', normalized.fullName],
    ['NIF/CIF', normalized.nif],
    ['dirección', normalized.address],
    ['código postal', normalized.postalCode],
    ['ciudad', normalized.city],
  ]
  const missing = required.filter(([, value]) => !value).map(([label]) => label)
  if (missing.length) throw new Error(`Completa los datos fiscales: ${missing.join(', ')}.`)
  return normalized
}

function invoiceAmounts(total: number) {
  const totalCents = Math.round(total * 100)
  if (
    !Number.isFinite(total) ||
    totalCents <= 0 ||
    totalCents > 99_999_999 ||
    Math.abs(total * 100 - totalCents) > 0.000001
  )
    throw new Error('El total debe ser un importe positivo con un máximo de dos decimales.')
  const netCents = Math.round(totalCents / 1.21)
  return {
    netAmount: netCents / 100,
    vatAmount: (totalCents - netCents) / 100,
    totalAmount: totalCents / 100,
  }
}

export async function persistInvoice(
  letter: Letter,
  payer: InvoicePayer,
  total: number,
  userId: string,
  clientInput: InvoiceClientInput,
  delivery?: PaymentDelivery,
) {
  if (!supabase) return null
  const fiscalData = fiscalClient(clientInput)
  const deliveryPhone = delivery?.phone.trim() || fiscalData.phone.trim()
  if (!deliveryPhone) throw new Error('Indica el móvil al que se enviará la factura por WhatsApp.')
  const deliveredClient = {
    ...fiscalData,
    phone: deliveryPhone,
  }
  const amounts = invoiceAmounts(total)
  const { data: clientRow, error: clientError } = await supabase
    .from('clients')
    .upsert(
      {
        full_name: deliveredClient.fullName.trim(),
        nif: deliveredClient.nif.trim(),
        email: deliveredClient.email.trim(),
        phone: deliveredClient.phone.trim(),
        address: deliveredClient.address.trim(),
        city: deliveredClient.city.trim(),
        postal_code: deliveredClient.postalCode.trim(),
      },
      { onConflict: 'normalized_name' },
    )
    .select('id, full_name, nif, email, phone, address, city, postal_code, created_at')
    .single()
  if (clientError) throw clientError
  const client = toClient(clientRow as ClientRow)
  const { data, error } = await supabase
    .from('invoice_drafts')
    .upsert(
      {
        letter_id: letter.id,
        client_id: client.id,
        payer,
        client_snapshot: deliveredClient,
        concept: 'Servicio de transporte de mascota',
        net_amount: amounts.netAmount,
        vat_amount: amounts.vatAmount,
        total_amount: amounts.totalAmount,
        vat_rate: 21,
        status: 'solicitud_pago',
        delivery_channel: 'whatsapp',
        delivery_email: '',
        delivery_phone: deliveryPhone,
        created_by: userId,
      },
      { onConflict: 'letter_id' },
    )
    .select('id, letter_id, client_id, payer, concept, total_amount, status, created_at')
  if (error) throw error
  const row = data?.[0]
  return {
    client,
    invoice: row
      ? {
          id: row.id,
          letterId: row.letter_id,
          clientId: row.client_id,
          payer: row.payer,
          concept: row.concept,
          total: Number(row.total_amount),
          status:
            row.status === 'solicitud_pago' ? ('solicitud_pago' as const) : ('emitida' as const),
          createdAt: row.created_at,
          clientName: client.fullName,
        }
      : null,
  }
}

export async function confirmManualInvoicePayment(
  invoiceId: string,
  paymentMethod: ManualPaymentMethod,
) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.functions.invoke('confirm-manual-invoice-payment', {
    body: { invoiceId, paymentMethod },
  })
  if (error) {
    const response =
      'context' in error &&
      error.context &&
      typeof error.context === 'object' &&
      'json' in error.context &&
      typeof error.context.json === 'function'
        ? (error.context as Response)
        : null
    const details = response
      ? ((await response.json().catch(() => null)) as { error?: string } | null)
      : null
    throw new Error(details?.error || error.message || 'No se ha podido registrar el cobro manual.')
  }
  const result = data as { error?: string } | null
  if (result?.error) throw new Error(result.error)
}
