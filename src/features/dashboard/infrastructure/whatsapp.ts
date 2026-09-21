import { supabase } from '@/shared/infrastructure/supabase'

export type WhatsAppTestKind = 'confirmacion' | 'recordatorio_ruta'

export async function sendWhatsAppTest(phone: string, kind: WhatsAppTestKind) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.functions.invoke('send-transport-notifications', {
    body: { action: 'test', phone, kind },
  })
  if (error) throw new Error(await functionError(error, 'No se ha podido contactar con WhatsApp.'))
  const result = data as { error?: string } | null
  if (result?.error) throw new Error(result.error)
}

async function functionError(error: unknown, fallback: string) {
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
    ? ((await response.json().catch(() => null)) as { error?: string } | null)
    : null
  return details?.error || fallback
}
