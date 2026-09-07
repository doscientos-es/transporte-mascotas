/** Accepts Spanish local numbers and international E.164-style numbers. */
export function isWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return /^[1-9][0-9]{7,14}$/.test(digits)
}
