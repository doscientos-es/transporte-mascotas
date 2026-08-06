import { rest } from '../_shared/supabase.ts';

type Invoice = { series: string; fiscal_year: number; sequence_number: number; issued_at: string; document_expires_at: string; fiscal_snapshot: { number?: string; issuer?: Record<string, string>; client?: Record<string, string>; concept?: string; net_amount?: number; vat_rate?: number; vat_amount?: number; total_amount?: number; payment_method?: string; payment_date?: string } }

Deno.serve(async (request) => {
  if (request.method !== 'GET') return page('Método no permitido.', 405)
  try {
    const token = new URL(request.url).searchParams.get('token')
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return page('Enlace de factura no válido.', 400)
    const response = await rest(`issued_invoices?public_token=eq.${encodeURIComponent(token)}&select=series,fiscal_year,sequence_number,issued_at,document_expires_at,fiscal_snapshot`)
    const [invoice] = await response.json() as Invoice[]
    if (!invoice || new Date(invoice.document_expires_at) <= new Date()) return page('Este enlace de factura ha caducado.', 410)
    return new Response(document(invoice), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } })
  } catch {
    return page('No se ha podido abrir la factura.', 503)
  }
})

function document(invoice: Invoice) {
  const data = invoice.fiscal_snapshot
  const number = data.number ?? `${invoice.series}-${invoice.fiscal_year}-${String(invoice.sequence_number).padStart(6, '0')}`
  const issuer = data.issuer ?? {}
  const client = data.client ?? {}
  const amount = (value: number | undefined) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value ?? 0))
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Factura ${escape(number)}</title><style>body{font:16px system-ui;max-width:760px;margin:48px auto;padding:0 24px;color:#172018}header,section{display:flex;justify-content:space-between;gap:32px;border-bottom:1px solid #d9ded8;padding:20px 0}.total{font-size:24px;font-weight:700}@media print{body{margin:0}}</style></head><body><header><div><h1>Factura ${escape(number)}</h1><p>Emitida: ${escape(new Date(invoice.issued_at).toLocaleDateString('es-ES'))}</p></div><div><strong>${escape(issuer.name ?? '')}</strong><br>${escape(issuer.taxId ?? '')}<br>${escape(issuer.address ?? '')}</div></header><section><div><strong>Cliente</strong><br>${escape(client.fullName ?? '')}<br>${escape(client.nif ?? '')}<br>${escape(client.address ?? '')}<br>${escape(client.postalCode ?? '')} ${escape(client.city ?? '')}</div><div><strong>Pago</strong><br>${escape(data.payment_method ?? 'Bizum')}<br>${escape(data.payment_date ? new Date(data.payment_date).toLocaleDateString('es-ES') : '')}</div></section><section><div><strong>${escape(data.concept ?? 'Servicio')}</strong><br>Base imponible: ${amount(data.net_amount)}<br>IVA (${escape(String(data.vat_rate ?? 0))}%): ${amount(data.vat_amount)}</div><div class="total">Total: ${amount(data.total_amount)}</div></section></body></html>`
}

function escape(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function page(message: string, status: number) { return new Response(`<!doctype html><html lang="es"><body><h1>${escape(message)}</h1></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }) }
