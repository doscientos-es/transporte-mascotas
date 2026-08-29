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

export async function dispatchTransportRequestNotifications(requestId: string) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data, error } = await supabase.functions.invoke('send-transport-notifications', {
    body: { action: 'dispatch', requestId },
  })
  if (error)
    throw new Error(await functionError(error, 'No se han podido enviar los avisos de WhatsApp.'))
  const result = data as { error?: string; failed?: number } | null
  if (result?.error || result?.failed)
    throw new Error(result.error || 'WhatsApp no ha aceptado el envío.')
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
