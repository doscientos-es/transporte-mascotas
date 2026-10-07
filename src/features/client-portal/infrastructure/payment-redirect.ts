export type PaymentRedirectForm = {
  endpoint: string
  fields: Record<string, string>
}

export async function loadPaymentRedirectForm(token: string, kind?: 'transport') {
  if (!/^[0-9a-f-]{36}$/i.test(token)) throw new Error('Enlace de pago no válido.')
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('El servicio de pago no está disponible.')

  const url = new URL('/functions/v1/payment-redirect', supabaseUrl)
  url.searchParams.set('token', token)
  url.searchParams.set('format', 'json')
  if (kind) url.searchParams.set('kind', kind)

  const response = await fetch(url)
  if (!response.ok) throw new Error('No se ha podido validar el enlace de pago.')
  const form = (await response.json()) as Partial<PaymentRedirectForm>
  if (
    typeof form.endpoint !== 'string' ||
    !form.fields ||
    typeof form.fields !== 'object' ||
    Object.values(form.fields).some((value) => typeof value !== 'string')
  )
    throw new Error('La pasarela no ha devuelto un formulario válido.')
  return form as PaymentRedirectForm
}
