import { requireSupabase } from '@/shared/infrastructure/supabase'

export async function sendEmailTest() {
  const { data, error } = await requireSupabase().functions.invoke('send-test-email', {
    body: {},
  })
  if (error) throw new Error(await functionError(error))

  const result = data as { sent?: boolean; email?: unknown; error?: unknown } | null
  if (typeof result?.error === 'string') throw new Error(result.error)
  if (!result?.sent || typeof result.email !== 'string')
    throw new Error('El servidor no confirmó el envío del email de prueba.')
  return { email: result.email }
}

async function functionError(error: unknown) {
  const response =
    error &&
    typeof error === 'object' &&
    'context' in error &&
    error.context &&
    typeof error.context === 'object' &&
    'json' in error.context &&
    typeof error.context.json === 'function'
      ? (error.context as Response)
      : null
  const details = response
    ? ((await response.clone().json().catch(() => null)) as
        | { error?: unknown; message?: unknown }
        | null)
    : null
  if (typeof details?.error === 'string') return details.error
  if (typeof details?.message === 'string') return details.message
  return response?.status
    ? `No se ha podido enviar el email de prueba. (HTTP ${response.status})`
    : 'No se ha podido enviar el email de prueba.'
}
