import { fetchInvoiceDocument, findCanonicalInvoiceDocument, persistIssuedInvoiceDocument } from '../_shared/invoice-document.ts'
import { corsHeaders, json, requireAdmin } from '../_shared/supabase.ts'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

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

Deno.serve(async (request) => {
  try {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (request.method === 'POST') {
      const userId = await requireAdmin(request)
      const { invoiceId } = await request.json() as { invoiceId?: string }
      if (!invoiceId || !/^[0-9a-f-]{36}$/i.test(invoiceId)) return json({ error: 'Factura no válida.' }, 400)
      const document = await persistIssuedInvoiceDocument(invoiceId, userId)
      const token = await signedToken(invoiceId, userId)
      const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/invoice-pdf`
      return json({ url: `${functionUrl}?token=${encodeURIComponent(token)}`, fileName: document.file_name })
    }
    if (request.method !== 'GET') return json({ error: 'Método no permitido.' }, 405)
    const token = url.searchParams.get('token')
    if (!token) return json({ error: 'Falta el enlace de factura.' }, 400)
    const invoiceId = await verifyToken(token)
    const document = await findCanonicalInvoiceDocument(invoiceId)
    if (!document) return json({ error: 'La factura todavía no se ha generado.' }, 404)
    const storedFile = await fetchInvoiceDocument(document)
    const disposition = url.searchParams.get('download') === '1' ? 'attachment' : 'inline'
    return new Response(storedFile.body, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `${disposition}; filename="${document.file_name}"; filename*=UTF-8''${encodeURIComponent(document.file_name)}`, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se ha podido generar la factura.' }, 500)
  }
})
