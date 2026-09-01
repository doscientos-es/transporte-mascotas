import { loadPaymentRequestLetterName } from '../infrastructure/letters'

/** Resolves the original document name, with the letter reference as a fallback. */
export function paymentRequestLetterName(letterId: string) {
  return loadPaymentRequestLetterName(letterId)
}
