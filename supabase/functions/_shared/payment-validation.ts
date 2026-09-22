export type CyberpacNotificationValidation = {
  signatureVersion: string
  order: string
  secret: string | undefined
  merchantCode: string | undefined
  terminal: string | undefined
  currency: string
  notification: Record<string, string>
  signature: string
  expectedSignature: string
}

export function isValidCyberpacNotification({
  signatureVersion,
  order,
  secret,
  merchantCode,
  terminal,
  currency,
  notification,
  signature,
  expectedSignature,
}: CyberpacNotificationValidation) {
  return (
    (signatureVersion === 'HMAC_SHA256_V1' || signatureVersion === 'HMAC_SHA512_V2') &&
    Boolean(order && secret && merchantCode && terminal) &&
    notification.Ds_MerchantCode === merchantCode &&
    normalizeCyberpacNumber(notification.Ds_Terminal) === normalizeCyberpacNumber(terminal) &&
    notification.Ds_Currency === currency &&
    signature === expectedSignature
  )
}

function normalizeCyberpacNumber(value: string | undefined) {
  const trimmed = value?.trim() ?? ''
  return /^\d+$/.test(trimmed) ? trimmed.replace(/^0+(?=\d)/, '') : trimmed
}

export function isSuccessfulCyberpacPayment({
  amount,
  response,
  expectedAmount,
  currency,
  expectedCurrency,
}: {
  amount: string | undefined
  response: string | undefined
  expectedAmount: number
  currency?: string
  expectedCurrency?: string
}) {
  const responseCode = Number(response)
  return (
    Number.isInteger(responseCode) &&
    responseCode >= 0 &&
    responseCode <= 99 &&
    Number(amount) === expectedAmount &&
    (!expectedCurrency || currency === expectedCurrency)
  )
}
