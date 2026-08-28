import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'
import { rest, serviceHeaders } from './supabase.ts'

type FiscalSnapshot = {
  number?: unknown
  issuer?: { name?: unknown; taxId?: unknown; address?: unknown }
  client?: { fullName?: unknown; nif?: unknown; address?: unknown; postalCode?: unknown; city?: unknown; email?: unknown; phone?: unknown }
  concept?: unknown; net_amount?: unknown; vat_rate?: unknown; vat_amount?: unknown; total_amount?: unknown
  payment_method?: unknown; payment_date?: unknown; operation_date?: unknown
}
type IssuedInvoice = { id: string; invoice_draft_id: string; issued_at: string; fiscal_snapshot: FiscalSnapshot }
export type StoredInvoiceDocument = { invoice_draft_id: string; issued_invoice_id: string | null; storage_path: string; file_name: string }

const text = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`La instantánea fiscal no incluye ${field}.`)
  return value.trim()
}
const amount = (value: unknown, field: string) => {
  const result = Number(value)
  if (!Number.isFinite(result) || result < 0) throw new Error(`La instantánea fiscal no incluye un ${field} válido.`)
  return result
}
const money = (value: number) => `${value.toFixed(2).replace('.', ',')} €`
const filePart = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
const date = (value: string) => new Date(value).toLocaleDateString('es-ES')

function storageUrl(path: string) {
  const baseUrl = Deno.env.get('SUPABASE_URL')
  if (!baseUrl) throw new Error('Falta SUPABASE_URL.')
  return `${baseUrl}/storage/v1/object/invoices/${path.split('/').map(encodeURIComponent).join('/')}`
}

export async function findInvoiceDocument(invoiceDraftId: string): Promise<StoredInvoiceDocument | null> {
  const response = await rest(`invoice_documents?invoice_draft_id=eq.${encodeURIComponent(invoiceDraftId)}&select=invoice_draft_id,issued_invoice_id,storage_path,file_name`)
  return (await response.json() as StoredInvoiceDocument[])[0] ?? null
}

async function issuedInvoice(invoiceDraftId: string): Promise<IssuedInvoice> {
  const response = await rest(`issued_invoices?invoice_draft_id=eq.${encodeURIComponent(invoiceDraftId)}&select=id,invoice_draft_id,issued_at,fiscal_snapshot`)
  const invoice = (await response.json() as IssuedInvoice[])[0]
  if (!invoice) throw new Error('La solicitud todavía no se ha emitido como factura.')
  return invoice
}

export async function findCanonicalInvoiceDocument(invoiceDraftId: string): Promise<StoredInvoiceDocument | null> {
  const invoice = await issuedInvoice(invoiceDraftId)
  const document = await findInvoiceDocument(invoiceDraftId)
  return document?.issued_invoice_id === invoice.id ? document : null
}

async function renderInvoice(invoice: IssuedInvoice) {
  const snapshot = invoice.fiscal_snapshot
  const issuer = snapshot.issuer ?? {}
  const client = snapshot.client ?? {}
  const number = text(snapshot.number, 'el número de factura')
  const issuerName = text(issuer.name, 'la razón social del emisor')
  const issuerTaxId = text(issuer.taxId, 'el NIF/CIF del emisor')
  const issuerAddress = text(issuer.address, 'la dirección del emisor')
  const clientName = text(client.fullName, 'la razón social del cliente')
  const clientNif = text(client.nif, 'el NIF/CIF del cliente')
  const clientAddress = text(client.address, 'la dirección del cliente')
  const clientPostalCode = text(client.postalCode, 'el código postal del cliente')
  const clientCity = text(client.city, 'la ciudad del cliente')
  const concept = text(snapshot.concept, 'el concepto')
  const netAmount = amount(snapshot.net_amount, 'base imponible')
  const vatAmount = amount(snapshot.vat_amount, 'IVA')
  const totalAmount = amount(snapshot.total_amount, 'total')
  const vatRate = amount(snapshot.vat_rate, 'tipo de IVA')
  if (Math.abs(totalAmount - (netAmount + vatAmount)) > 0.001) throw new Error('Los importes de la instantánea fiscal no coinciden.')

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const draw = (value: string, x: number, y: number, size = 10, emphasis = false) => page.drawText(value, { x, y, size, font: emphasis ? bold : regular, color: rgb(0.09, 0.09, 0.09) })
  const clientLines = [clientNif && `NIF/CIF: ${clientNif}`, clientAddress, `${clientPostalCode} ${clientCity}`, typeof client.email === 'string' ? client.email : '', typeof client.phone === 'string' ? `Tel.: ${client.phone}` : ''].filter(Boolean)

  draw('Factura', 54, 790, 23, true)
  draw(issuerName, 54, 758, 11, true); draw(`NIF/CIF: ${issuerTaxId}`, 54, 742); draw(issuerAddress, 54, 728, 9)
  draw('CLIENTE', 54, 670, 9, true); draw(clientName, 54, 651, 11, true)
  clientLines.forEach((line, index) => draw(line, 54, 635 - index * 14, 9))
  draw('NÚMERO', 430, 670, 9, true); draw(number, 430, 651, 10)
  draw('FECHA EMISIÓN', 430, 625, 9, true); draw(date(invoice.issued_at), 430, 606, 10)
  page.drawRectangle({ x: 54, y: 540, width: 487, height: 28, color: rgb(0.97, 0.26, 0.27) })
  page.drawText('CONCEPTO', { x: 62, y: 551, size: 9, font: bold, color: rgb(1, 1, 1) })
  page.drawText('BASE', { x: 480, y: 551, size: 9, font: bold, color: rgb(1, 1, 1) })
  draw(concept, 62, 518, 10); draw(money(netAmount), 475, 518, 10, true)
  draw('Base imponible', 370, 455, 10); draw(money(netAmount), 485, 455, 10)
  draw(`IVA (${vatRate} %)`, 370, 435, 10); draw(money(vatAmount), 485, 435, 10)
  draw('Total', 370, 395, 14, true); draw(money(totalAmount), 465, 395, 15, true)
  draw('OPERACIÓN Y COBRO', 54, 335, 9, true)
  draw(`Fecha operación: ${date(typeof snapshot.operation_date === 'string' ? snapshot.operation_date : invoice.issued_at)}`, 54, 315, 10)
  draw(`Método de pago: ${typeof snapshot.payment_method === 'string' ? snapshot.payment_method : 'Pago confirmado'}`, 54, 297, 10)
  return { body: await pdf.save(), fileName: `factura_${filePart(number)}.pdf` }
}

/** Creates once and returns the immutable PDF that corresponds to an issued invoice snapshot. */
export async function persistIssuedInvoiceDocument(invoiceDraftId: string, generatedBy?: string): Promise<StoredInvoiceDocument> {
  const invoice = await issuedInvoice(invoiceDraftId)
  const existing = await findInvoiceDocument(invoiceDraftId)
  if (existing?.issued_invoice_id === invoice.id) return existing
  const document = await renderInvoice(invoice)
  const path = `${invoice.id}/${document.fileName}`
  const upload = await fetch(storageUrl(path), { method: 'POST', headers: { ...serviceHeaders(), 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: document.body })
  if (!upload.ok && upload.status !== 409) throw new Error('No se ha podido guardar el PDF de la factura.')
  await rest('invoice_documents?on_conflict=invoice_draft_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ invoice_draft_id: invoiceDraftId, issued_invoice_id: invoice.id, storage_path: path, file_name: document.fileName, ...(generatedBy ? { generated_by: generatedBy } : {}) }),
  })
  const stored = await findInvoiceDocument(invoiceDraftId)
  if (!stored || stored.issued_invoice_id !== invoice.id) throw new Error('No se ha podido registrar el PDF de la factura.')
  return stored
}

export async function fetchInvoiceDocument(document: StoredInvoiceDocument): Promise<Response> {
  const response = await fetch(storageUrl(document.storage_path), { headers: serviceHeaders() })
  if (!response.ok || !response.body) throw new Error('No se ha podido recuperar el PDF guardado.')
  return response
}
