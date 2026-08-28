import { fetchInvoiceDocument, findInvoiceDocument } from '../_shared/invoice-document.ts'
import { rest } from '../_shared/supabase.ts'

type Invoice = { id: string; invoice_draft_id: string; document_expires_at: string }

Deno.serve(async (request) => {
  if (request.method !== 'GET') return page('Método no permitido.', 405)
  try {
    const token = new URL(request.url).searchParams.get('token')
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return page('Enlace de factura no válido.', 400)
    const response = await rest(
      `issued_invoices?public_token=eq.${encodeURIComponent(token)}&select=id,invoice_draft_id,document_expires_at`,
    )
    const [invoice] = (await response.json()) as Invoice[]
    if (!invoice || new Date(invoice.document_expires_at) <= new Date())
      return page('Este enlace de factura ha caducado.', 410)
    const document = await findInvoiceDocument(invoice.invoice_draft_id)
    if (!document || document.issued_invoice_id !== invoice.id)
      return page('La factura todavía se está preparando.', 503)
    const storedFile = await fetchInvoiceDocument(document)
    return new Response(storedFile.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${document.file_name}"; filename*=UTF-8''${encodeURIComponent(document.file_name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    })
  } catch {
    return page('No se ha podido abrir la factura.', 503)
  }
})

function page(message: string, status: number) {
  return new Response(
    `<!doctype html><html lang="es"><body><h1>${escape(message)}</h1></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
function escape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
