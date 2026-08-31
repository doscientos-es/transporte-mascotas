export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': [
    'authorization',
    'apikey',
    'content-type',
    'x-client-info',
    'x-supabase-client-platform',
    'x-supabase-client-platform-version',
    'x-supabase-client-runtime',
    'x-supabase-client-runtime-version',
  ].join(', '),
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function serviceHeaders() {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY.')
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

export async function rest(path: string, init: RequestInit = {}) {
  const url = Deno.env.get('SUPABASE_URL')
  if (!url) throw new Error('Falta SUPABASE_URL.')
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...serviceHeaders(), ...init.headers },
  })
  if (!response.ok) throw new Error(`Error de base de datos (${response.status}).`)
  return response
}

export async function requireAdmin(request: Request) {
  const authorization = request.headers.get('authorization')
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authorization || !url || !key) throw new Error('No autenticado.')
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: authorization },
  })
  if (!userResponse.ok) throw new Error('No autenticado.')
  const user = (await userResponse.json()) as { id: string }
  const profileResponse = await rest(`profiles?id=eq.${encodeURIComponent(user.id)}&select=role`)
  const [profile] = (await profileResponse.json()) as Array<{ role: string }>
  if (profile?.role !== 'admin') throw new Error('No tienes permisos para generar pagos.')
  return user.id
}
