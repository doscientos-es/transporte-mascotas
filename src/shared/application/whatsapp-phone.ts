/** Accepts Spanish local numbers and international E.164-style numbers. */
export function isWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return /^[1-9][0-9]{7,14}$/.test(digits)
}

/** Builds a wa.me link, assuming Spain (+34) for 9-digit local numbers. */
export function whatsAppUrl(phone: string, message?: string) {
  const digits = phone.trim().replace(/\D/g, '').replace(/^00/, '')
  if (!isWhatsAppPhone(digits)) return null
  const number = /^[6-9][0-9]{8}$/.test(digits) ? `34${digits}` : digits
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ''}`
}
