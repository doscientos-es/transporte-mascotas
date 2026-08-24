import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

function safe(value: unknown) {
  return String(value ?? '').replace(/[()\\]/g, '\\$&').replace(/[^\x20-\x7E]/g, '?')
}

function pdf(title: string, rows: Array<[string, unknown]>) {
  const lines = [title, '', ...rows.map(([label, value]) => `${label}: ${safe(value)}`)]
  const stream = ['BT', '/F1 16 Tf', '48 790 Td', `(${safe(lines[0])}) Tj`, '/F1 10 Tf', ...lines.slice(1).flatMap((line) => ['0 -18 Td', `(${safe(line)}) Tj`]), 'ET'].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let output = '%PDF-1.4\n'; const offsets = [0]
  objects.forEach((object, index) => { offsets.push(output.length); output += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const start = output.length
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`
  return new TextEncoder().encode(output)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const authorization = request.headers.get('Authorization')
  if (!authorization) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors })
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { global: { headers: { Authorization: authorization } } })
  const { data: user } = await client.auth.getUser(authorization.replace('Bearer ', ''))
  const { data: profile } = user.user ? await client.from('profiles').select('role,active').eq('id', user.user.id).single() : { data: null }
  if (!profile?.active || profile.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403, headers: cors })
  const { reservationId } = await request.json()
  const { data: reservation } = await client.from('reservations').select('id,letter_id,quoted_amount,sender,recipient,daily_routes(service_date,route_templates(name))').eq('id', reservationId).single()
  if (!reservation?.letter_id) return Response.json({ error: 'Confirmed reservation not found' }, { status: 404, headers: cors })
  const { data: letter } = await client.from('carriage_letters').select('id,service_date,sender_name,recipient_name,origin_text,destination_text,animals(species,breed,microchip,weight_kg,recommended_category)').eq('id', reservation.letter_id).single()
  const { data: invoice } = await client.from('invoice_drafts').select('id,invoice_number,concept,net_amount,tax_amount,total_amount,payer,client_snapshot').eq('letter_id', reservation.letter_id).single()
  if (!letter || !invoice) return Response.json({ error: 'Operational records not found' }, { status: 404, headers: cors })
  const animal = Array.isArray(letter.animals) ? letter.animals[0] : null
  const base = `reservations/${reservation.id}`
  const letterPath = `${base}/carta-de-porte.pdf`; const invoicePath = `${base}/factura.pdf`
  const letterPdf = pdf('KACHE ENVIOS - CARTA DE PORTE', [['Numero', letter.id], ['Fecha', letter.service_date], ['Remitente', letter.sender_name], ['Destinatario', letter.recipient_name], ['Origen', letter.origin_text], ['Destino', letter.destination_text], ['Animal', `${animal?.species ?? ''} ${animal?.breed ?? ''}`], ['Microchip', animal?.microchip], ['Peso kg', animal?.weight_kg], ['Categoria', animal?.recommended_category]])
  const invoicePdf = pdf('KACHE ENVIOS - FACTURA', [['Numero', invoice.invoice_number], ['Concepto', invoice.concept], ['Pagador', invoice.payer], ['Base imponible', invoice.net_amount], ['IVA', invoice.tax_amount], ['Total', invoice.total_amount]])
  const { error: bucketError } = await client.storage.createBucket('operational-documents', { public: false })
  if (bucketError && !/already exists/i.test(bucketError.message)) return Response.json({ error: bucketError.message }, { status: 502, headers: cors })
  const uploads = await Promise.all([client.storage.from('operational-documents').upload(letterPath, letterPdf, { contentType: 'application/pdf', upsert: true }), client.storage.from('operational-documents').upload(invoicePath, invoicePdf, { contentType: 'application/pdf', upsert: true })])
  if (uploads.some(({ error }) => error)) return Response.json({ error: uploads.find(({ error }) => error)?.error?.message ?? 'Upload failed' }, { status: 502, headers: cors })
  await Promise.all([client.from('carriage_letters').update({ document_path: letterPath }).eq('id', letter.id), client.from('invoice_drafts').update({ document_path: invoicePath, delivery_status: 'pending' }).eq('id', invoice.id)])
  return Response.json({ ok: true, letterPath, invoicePath }, { headers: cors })
})
