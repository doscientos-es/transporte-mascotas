import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'
import { corsHeaders, json, requireAdmin, rest, serviceHeaders } from '../_shared/supabase.ts'

type InvoiceRow = { id: string; letter_id: string; concept: string; total_amount: number; created_at: string; client_snapshot: { fullName?: string; nif?: string; address?: string; postalCode?: string; city?: string } }
type LetterRow = { service_date: string }
type StoredDocument = { storage_path: string; file_name: string }

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function filePart(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function base64url(value: Uint8Array) { return btoa(String.fromCharCode(...value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '') }
function fromBase64url(value: string) { return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), (character) => character.charCodeAt(0)) }

async function signature(payload: string) {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!secret) throw new Error('No se ha configurado la firma de documentos.')
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))))
}

async function signedToken(invoiceId: string, userId: string) {
  const payload = base64url(encoder.encode(JSON.stringify({ invoiceId, userId, expiresAt: Date.now() + 10 * 60_000 })))
  return `${payload}.${await signature(payload)}`
}

async function verifyToken(token: string) {
  const [payload, receivedSignature] = token.split('.')
  if (!payload || !receivedSignature || receivedSignature !== await signature(payload)) throw new Error('El enlace de la factura no es válido.')
  const value = JSON.parse(decoder.decode(fromBase64url(payload))) as { invoiceId?: string; expiresAt?: number }
  if (!value.invoiceId || !value.expiresAt || value.expiresAt < Date.now()) throw new Error('El enlace de la factura ha caducado.')
  return value.invoiceId
}

async function invoiceDocument(invoice: InvoiceRow, serviceDate: string) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const total = Number(invoice.total_amount)
  const base = total / 1.21
  const vat = total - base
  const client = invoice.client_snapshot ?? {}
  const draw = (text: string, x: number, y: number, size = 10, emphasis = false) => page.drawText(text, { x, y, size, font: emphasis ? bold : regular, color: rgb(0.09, 0.09, 0.09) })
  const money = (value: number) => `${value.toFixed(2).replace('.', ',')} €`

  draw('Factura', 54, 790, 23, true)
  draw('Kache Envíos', 54, 758, 11, true)
  draw('NIF: 80156982G', 54, 742)
  draw('Ctra. Pedroche s/n km 1,5 · 14400 Pozoblanco · Córdoba', 54, 728, 9)
  draw('CLIENTE', 54, 670, 9, true)
  draw(client.fullName || 'Cliente', 54, 651, 11, true)
  ;[client.nif && `NIF/CIF: ${client.nif}`, client.address, [client.postalCode, client.city].filter(Boolean).join(' ')].filter(Boolean).forEach((line, index) => draw(line as string, 54, 635 - index * 14, 9))
  draw('FECHA', 430, 670, 9, true)
  draw(new Date(`${serviceDate}T12:00:00`).toLocaleDateString('es-ES'), 430, 651, 10)
  page.drawRectangle({ x: 54, y: 540, width: 487, height: 28, color: rgb(0.97, 0.26, 0.27) })
  page.drawText('CONCEPTO', { x: 62, y: 551, size: 9, font: bold, color: rgb(1, 1, 1) })
  page.drawText('TOTAL', { x: 485, y: 551, size: 9, font: bold, color: rgb(1, 1, 1) })
  draw(invoice.concept || 'Servicio de transporte de mascota', 62, 518, 10)
  draw(money(total), 475, 518, 10, true)
  draw('Base imponible', 370, 455, 10); draw(money(base), 485, 455, 10)
  draw('IVA (21 %)', 370, 435, 10); draw(money(vat), 485, 435, 10)
  draw('Total', 370, 395, 14, true); draw(money(total), 465, 395, 15, true)
  draw('Método de pago: Transferencia', 54, 315, 10, true)
  draw('ES19 2100 2093 9702 0016 6247', 54, 297, 10)
  return pdf.save()
}

async function findStoredDocument(invoiceId: string) {
  const response = await rest(`invoice_documents?invoice_draft_id=eq.${encodeURIComponent(invoiceId)}&select=storage_path,file_name`)
  const [document] = await response.json() as StoredDocument[]
  return document
}

async function persistInvoiceDocument(invoiceId: string, userId: string) {
  const existing = await findStoredDocument(invoiceId)
  if (existing) return existing

  const invoiceResponse = await rest(`invoice_drafts?id=eq.${encodeURIComponent(invoiceId)}&select=id,letter_id,concept,total_amount,created_at,client_snapshot`)
  const [invoice] = await invoiceResponse.json() as InvoiceRow[]
  if (!invoice) throw new Error('Factura no encontrada.')
  const letterResponse = await rest(`carriage_letters?id=eq.${encodeURIComponent(invoice.letter_id)}&select=service_date`)
  const [letter] = await letterResponse.json() as LetterRow[]
  const serviceDate = letter?.service_date || invoice.created_at.slice(0, 10)
  const fileName = `factura_${filePart(invoice.client_snapshot?.fullName || 'cliente')}_${filePart(serviceDate)}.pdf`
  const storagePath = `${invoice.id}/${fileName}`
  const storageUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/invoices/${storagePath.split('/').map(encodeURIComponent).join('/')}`
  const upload = await fetch(storageUrl, {
    method: 'POST',
    headers: { ...serviceHeaders(), 'Content-Type': 'application/pdf', 'x-upsert': 'false' },
    body: await invoiceDocument(invoice, serviceDate),
  })
  if (!upload.ok && upload.status !== 409) throw new Error('No se ha podido guardar el PDF de la factura.')

  await rest('invoice_documents?on_conflict=invoice_draft_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ invoice_draft_id: invoice.id, storage_path: storagePath, file_name: fileName, generated_by: userId }),
  })
  const document = await findStoredDocument(invoiceId)
  if (!document) throw new Error('No se ha podido registrar el PDF de la factura.')
  return document
}

Deno.serve(async (request) => {
  try {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (request.method === 'POST') {
      const userId = await requireAdmin(request)
      const { invoiceId } = await request.json() as { invoiceId?: string }
      if (!invoiceId || !/^[0-9a-f-]{36}$/i.test(invoiceId)) return json({ error: 'Factura no válida.' }, 400)
      const document = await persistInvoiceDocument(invoiceId, userId)
      const token = await signedToken(invoiceId, userId)
      const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/invoice-pdf`
      return json({ url: `${functionUrl}?token=${encodeURIComponent(token)}`, fileName: document.file_name })
    }
    if (request.method !== 'GET') return json({ error: 'Método no permitido.' }, 405)
    const token = url.searchParams.get('token')
    if (!token) return json({ error: 'Falta el enlace de factura.' }, 400)
    const invoiceId = await verifyToken(token)
    const document = await findStoredDocument(invoiceId)
    if (!document) return json({ error: 'La factura todavía no se ha generado.' }, 404)
    const storageUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/invoices/${document.storage_path.split('/').map(encodeURIComponent).join('/')}`
    const storedFile = await fetch(storageUrl, { headers: serviceHeaders() })
    if (!storedFile.ok || !storedFile.body) throw new Error('No se ha podido recuperar el PDF guardado.')
    return new Response(storedFile.body, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${document.file_name}"; filename*=UTF-8''${encodeURIComponent(document.file_name)}`, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se ha podido generar la factura.' }, 500)
  }
})
