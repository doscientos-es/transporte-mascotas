import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

import { rest, serviceHeaders } from './supabase.ts'

type FiscalSnapshot = {
  number?: unknown
  issuer?: { name?: unknown; taxId?: unknown; address?: unknown }
  client?: {
    fullName?: unknown
    nif?: unknown
    address?: unknown
    postalCode?: unknown
    city?: unknown
    email?: unknown
    phone?: unknown
  }
  concept?: unknown
  net_amount?: unknown
  vat_rate?: unknown
  vat_amount?: unknown
  total_amount?: unknown
  payment_method?: unknown
  payment_date?: unknown
  operation_date?: unknown
}
type IssuedInvoice = {
  id: string
  invoice_draft_id: string
  issued_at: string
  fiscal_snapshot: FiscalSnapshot
}
export type StoredInvoiceDocument = {
  invoice_draft_id: string
  issued_invoice_id: string | null
  storage_path: string
  file_name: string
}

const text = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`La instantánea fiscal no incluye ${field}.`)
  return value.trim()
}
const amount = (value: unknown, field: string) => {
  const result = Number(value)
  if (!Number.isFinite(result) || result < 0)
    throw new Error(`La instantánea fiscal no incluye un ${field} válido.`)
  return result
}
const money = (value: number) => `${value.toFixed(2).replace('.', ',')} €`
const filePart = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
const date = (value: string) => new Date(value).toLocaleDateString('es-ES')

function storageUrl(path: string) {
  const baseUrl = Deno.env.get('SUPABASE_URL')
  if (!baseUrl) throw new Error('Falta SUPABASE_URL.')
  return `${baseUrl}/storage/v1/object/invoices/${path.split('/').map(encodeURIComponent).join('/')}`
}

export async function findInvoiceDocument(
  invoiceDraftId: string,
): Promise<StoredInvoiceDocument | null> {
  const response = await rest(
    `invoice_documents?invoice_draft_id=eq.${encodeURIComponent(invoiceDraftId)}&select=invoice_draft_id,issued_invoice_id,storage_path,file_name`,
  )
  return ((await response.json()) as StoredInvoiceDocument[])[0] ?? null
}

async function issuedInvoice(invoiceDraftId: string): Promise<IssuedInvoice> {
  const response = await rest(
    `issued_invoices?invoice_draft_id=eq.${encodeURIComponent(invoiceDraftId)}&select=id,invoice_draft_id,issued_at,fiscal_snapshot`,
  )
  const invoice = ((await response.json()) as IssuedInvoice[])[0]
  if (!invoice) throw new Error('La solicitud todavía no se ha emitido como factura.')
  return invoice
}

export async function findCanonicalInvoiceDocument(
  invoiceDraftId: string,
): Promise<StoredInvoiceDocument | null> {
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
  if (Math.abs(totalAmount - (netAmount + vatAmount)) > 0.001)
    throw new Error('Los importes de la instantánea fiscal no coinciden.')

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.11, 0.11, 0.1)
  const coral = rgb(0.96, 0.26, 0.27)
  const cream = rgb(0.98, 0.96, 0.94)
  const muted = rgb(0.42, 0.4, 0.38)
  const white = rgb(1, 1, 1)
  const draw = (value: string, x: number, y: number, size = 10, emphasis = false, color = ink) =>
    page.drawText(value, {
      x,
      y,
      size,
      font: emphasis ? bold : regular,
      color,
    })
  const drawRight = (
    value: string,
    right: number,
    y: number,
    size = 10,
    emphasis = false,
    color = ink,
  ) =>
    draw(
      value,
      right - (emphasis ? bold : regular).widthOfTextAtSize(value, size),
      y,
      size,
      emphasis,
      color,
    )
  const drawLines = (
    values: string[],
    x: number,
    y: number,
    size = 9,
    emphasis = false,
    color = ink,
    gap = 14,
  ) => values.forEach((value, index) => draw(value, x, y - index * gap, size, emphasis, color))
  const drawLogo = (x: number, y: number) => {
    page.drawEllipse({ x, y, width: 42, height: 42, color: white })
    draw('K', x + 13, y + 12, 20, true, coral)
  }
  const clientLines = [
    clientNif && `NIF/CIF: ${clientNif}`,
    clientAddress,
    `${clientPostalCode} ${clientCity}`,
    typeof client.email === 'string' ? client.email : '',
    typeof client.phone === 'string' ? `Tel.: ${client.phone}` : '',
  ].filter(Boolean)

  page.drawRectangle({ x: 0, y: 724, width: 595.28, height: 117.89, color: ink })
  drawLogo(54, 761)
  draw('KACHE ENVÍOS', 112, 786, 18, true, white)
  draw('Transporte de mascotas', 112, 767, 10, false, white)
  drawRight('FACTURA', 541, 794, 21, true, coral)
  drawRight(`N.º ${number}`, 541, 774, 10, false, white)
  drawRight(date(invoice.issued_at), 541, 758, 9, false, white)

  draw('EMISOR', 54, 695, 8, true, muted)
  draw(issuerName, 54, 677, 11, true)
  draw(`NIF/CIF: ${issuerTaxId}`, 54, 661, 9, false, muted)
  draw(issuerAddress, 54, 647, 9, false, muted)

  page.drawRectangle({ x: 54, y: 520, width: 487, height: 105, color: cream })
  draw('CLIENTE', 72, 601, 8, true, muted)
  draw(clientName, 72, 583, 11, true)
  drawLines(clientLines, 72, 567, 8.5, false, muted, 13)

  draw('DATOS DE EMISIÓN', 365, 601, 8, true, muted)
  draw('Número de factura', 365, 583, 8.5, false, muted)
  draw(number, 365, 568, 10, true)
  draw('Fecha de emisión', 365, 548, 8.5, false, muted)
  draw(date(invoice.issued_at), 365, 533, 10, true)

  page.drawRectangle({ x: 54, y: 442, width: 487, height: 32, color: coral })
  draw('CONCEPTO', 72, 454, 8, true, white)
  drawRight('BASE IMPONIBLE', 523, 454, 8, true, white)
  draw(concept, 72, 420, 10)
  drawRight(money(netAmount), 523, 420, 10, true, ink)
  page.drawLine({ start: { x: 54, y: 403 }, end: { x: 541, y: 403 }, thickness: 0.6, color: cream })

  page.drawRectangle({ x: 337, y: 270, width: 204, height: 105, color: cream })
  draw('RESUMEN', 357, 355, 8, true, muted)
  draw('Base imponible', 357, 332, 10)
  drawRight(money(netAmount), 520, 332, 10, false, ink)
  draw(`IVA (${vatRate} %)`, 357, 310, 10)
  drawRight(money(vatAmount), 520, 310, 10, false, ink)
  page.drawLine({
    start: { x: 357, y: 291 },
    end: { x: 520, y: 291 },
    thickness: 0.8,
    color: coral,
  })
  draw('TOTAL', 357, 278, 10, true, coral)
  drawRight(money(totalAmount), 520, 278, 14, true, coral)

  draw('OPERACIÓN Y COBRO', 54, 355, 8, true, muted)
  draw(
    `Fecha de operación: ${date(typeof snapshot.operation_date === 'string' ? snapshot.operation_date : invoice.issued_at)}`,
    54,
    332,
    9,
  )
  draw(
    `Método de pago: ${typeof snapshot.payment_method === 'string' ? snapshot.payment_method : 'Pago confirmado'}`,
    54,
    314,
    9,
  )
  if (typeof snapshot.payment_date === 'string')
    draw(`Cobro confirmado: ${date(snapshot.payment_date)}`, 54, 296, 9)

  page.drawLine({ start: { x: 54, y: 82 }, end: { x: 541, y: 82 }, thickness: 0.7, color: cream })
  draw(
    'KACHE ENVÍOS  ·  Documento generado desde una instantánea fiscal inmutable',
    54,
    62,
    8,
    false,
    muted,
  )
  return { body: await pdf.save(), fileName: `factura_${filePart(number)}.pdf` }
}

/** Creates once and returns the immutable PDF that corresponds to an issued invoice snapshot. */
export async function persistIssuedInvoiceDocument(
  invoiceDraftId: string,
  generatedBy?: string,
): Promise<StoredInvoiceDocument> {
  const invoice = await issuedInvoice(invoiceDraftId)
  const existing = await findInvoiceDocument(invoiceDraftId)
  if (existing?.issued_invoice_id === invoice.id) return existing
  const document = await renderInvoice(invoice)
  const path = `${invoice.id}/${document.fileName}`
  const upload = await fetch(storageUrl(path), {
    method: 'POST',
    headers: { ...serviceHeaders(), 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
    body: document.body,
  })
  if (!upload.ok && upload.status !== 409)
    throw new Error('No se ha podido guardar el PDF de la factura.')
  await rest('invoice_documents?on_conflict=invoice_draft_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      invoice_draft_id: invoiceDraftId,
      issued_invoice_id: invoice.id,
      storage_path: path,
      file_name: document.fileName,
      ...(generatedBy ? { generated_by: generatedBy } : {}),
    }),
  })
  const stored = await findInvoiceDocument(invoiceDraftId)
  if (!stored || stored.issued_invoice_id !== invoice.id)
    throw new Error('No se ha podido registrar el PDF de la factura.')
  return stored
}

export async function fetchInvoiceDocument(document: StoredInvoiceDocument): Promise<Response> {
  const response = await fetch(storageUrl(document.storage_path), { headers: serviceHeaders() })
  if (!response.ok || !response.body) throw new Error('No se ha podido recuperar el PDF guardado.')
  return response
}
