import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const authorization = request.headers.get('Authorization')
  if (!authorization) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { global: { headers: { Authorization: authorization } } })
  const { data: user } = await client.auth.getUser(authorization.replace('Bearer ', ''))
  const { data: profile } = user.user ? await client.from('profiles').select('role,active').eq('id', user.user.id).single() : { data: null }
  if (!profile?.active || profile.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403, headers: cors })

  const { reservationId } = await request.json()
  const { data: deliveries, error } = await client.from('document_deliveries').select('id').eq('reservation_id', reservationId).eq('status', 'pending')
  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors })
  const endpoint = `${Deno.env.get('SUPABASE_URL')}/functions/v1/deliver-documents`
  const results = await Promise.all((deliveries ?? []).map(async ({ id }) => {
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ deliveryId: id }) })
    return { id, ok: response.ok }
  }))
  return Response.json({ ok: results.every((result) => result.ok), results }, { headers: cors })
})
