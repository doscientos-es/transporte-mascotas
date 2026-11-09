import {
  persistIssuedInvoiceDocument,
  uploadInvoiceRevision,
  type FiscalSnapshot,
  type IssuedInvoice,
} from '../_shared/invoice-document.ts'
import { corsHeaders, json, requireAdmin, rest } from '../_shared/supabase.ts'

type Input = {
  invoiceId?: string
  expectedSnapshot?: FiscalSnapshot
  client?: Record<string, unknown>
  concept?: string
  operationDate?: string
  total?: number
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
  try {
    const actorId = await requireAdmin(request)
    const input = (await request.json().catch(() => null)) as Input | null
    const fields = ['fullName', 'nif', 'address', 'postalCode', 'city', 'email', 'phone'] as const
    if (
      !input ||
      typeof input.invoiceId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.invoiceId) ||
      !input.expectedSnapshot ||
      typeof input.expectedSnapshot !== 'object' ||
      !input.client ||
      fields.some(
        (field) =>
          typeof input.client?.[field] !== 'string' || (input.client[field] as string).length > 300,
      ) ||
      fields.slice(0, 5).some((field) => !(input.client?.[field] as string).trim()) ||
      typeof input.concept !== 'string' ||
      !input.concept.trim() ||
      input.concept.trim().length > 500 ||
      typeof input.total !== 'number' ||
      !Number.isFinite(input.total) ||
      input.total <= 0 ||
      input.total > 999999.99 ||
      Math.abs(input.total * 100 - Math.round(input.total * 100)) > 0.000001 ||
      typeof input.operationDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.operationDate) ||
      Number.isNaN(Date.parse(`${input.operationDate}T12:00:00Z`)) ||
      new Date(`${input.operationDate}T12:00:00Z`).toISOString().slice(0, 10) !==
        input.operationDate
    )
      return json({ error: 'Revisa los datos de la factura.' }, 400)

    const response = await rest(
      `issued_invoices?invoice_draft_id=eq.${encodeURIComponent(input.invoiceId)}&select=id,invoice_draft_id,issued_at,fiscal_snapshot`,
    )
    const [invoice] = (await response.json()) as IssuedInvoice[]
    if (!invoice) return json({ error: 'Factura no encontrada.' }, 404)
    const vatRate = Number(invoice.fiscal_snapshot.vat_rate ?? NaN)
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100 ||
        Math.abs(vatRate * 100 - Math.round(vatRate * 100)) > 0.000001)
      throw new Error('El tipo de IVA de la factura no es válido.')
    // Always save the old PDF before creating a new version.
    await persistIssuedInvoiceDocument(input.invoiceId, actorId)
    const client = Object.fromEntries(
      fields.map((field) => [field, (input.client![field] as string).trim()]),
    )
    const snapshot: FiscalSnapshot = {
      ...input.expectedSnapshot,
      client,
      concept: input.concept.trim(),
      operation_date: input.operationDate,
    }
    if (input.total !== Number(invoice.fiscal_snapshot.total_amount)) {
      const totalCents = Math.round(input.total * 100)
      const netCents = Math.round((totalCents * 10000) / (10000 + Math.round(vatRate * 100)))
      snapshot.net_amount = netCents / 100
      snapshot.vat_amount = (totalCents - netCents) / 100
      snapshot.total_amount = totalCents / 100
    }
    const document = await uploadInvoiceRevision({ ...invoice, fiscal_snapshot: snapshot })
    await rest('rpc/edit_issued_invoice', {
      method: 'POST',
      body: JSON.stringify({
        p_invoice_id: input.invoiceId,
        p_actor_id: actorId,
        p_expected_snapshot: input.expectedSnapshot,
        p_snapshot: snapshot,
        p_storage_path: document.path,
        p_file_name: document.fileName,
      }),
    })
    return json({ invoiceId: input.invoiceId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se ha podido editar la factura.'
    const status =
      message === 'No autenticado.'
        ? 401
        : message === 'No tienes permisos para generar pagos.'
          ? 403
          : 500
    return json(
      {
        error:
          status === 500
            ? 'No se ha podido guardar la factura. Actualiza la página y vuelve a intentarlo.'
            : message,
      },
      status,
    )
  }
})
