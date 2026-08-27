import { supabase } from './supabase'

export async function prepareInvoiceDocument(invoiceId: string) {
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(invoiceId)) return null
  const { data, error } = await supabase.functions.invoke('invoice-pdf', { body: { invoiceId } })
  if (error) {
    const response = 'context' in error && error.context && typeof error.context === 'object' && 'json' in error.context && typeof error.context.json === 'function'
      ? error.context as Response
      : null
    const details = response ? await response.json().catch(() => null) as { error?: string } | null : null
    throw new Error(details?.error || error.message || 'No se ha podido obtener la factura guardada.')
  }
  const { url, fileName } = (data as { url?: string; fileName?: string } | null) ?? {}
  if (!url) throw new Error('La factura no ha devuelto un enlace de descarga.')
  return { url, fileName: fileName ?? '' }
}
