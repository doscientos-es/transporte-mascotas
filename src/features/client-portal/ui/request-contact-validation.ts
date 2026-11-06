import type { RequestFormValues } from './client-request-form'

export function validateRequestContactDetails(values: RequestFormValues): {
  message: string
  fieldId?: string
} {
  const requiredPartyFields: Array<[string, string, string]> = [
    ['nombre de quien envía', values.contactName, 'request-contact-name'],
    ['DNI/NIE de quien envía', values.senderNif, 'request-sender-nif'],
    ['teléfono de quien envía', values.contactPhone, 'request-contact-phone'],
    ['correo de quien envía', values.contactEmail, 'request-contact-email'],
    ['dirección de quien envía', values.senderAddress, 'request-sender-address'],
    ['código postal de quien envía', values.senderPostalCode, 'request-sender-postal-code'],
    ['localidad de quien envía', values.senderCity, 'request-sender-city'],
    ['provincia de quien envía', values.senderProvince, 'request-sender-province'],
    ['nombre de quien recibe', values.recipientName, 'request-recipient-name'],
    ['DNI/NIE de quien recibe', values.recipientNif, 'request-recipient-nif'],
    ['teléfono de quien recibe', values.recipientPhone, 'request-recipient-phone'],
    ['correo de quien recibe', values.recipientEmail, 'request-recipient-email'],
    ['dirección de quien recibe', values.recipientAddress, 'request-recipient-address'],
    ['código postal de quien recibe', values.recipientPostalCode, 'request-recipient-postal-code'],
    ['localidad de quien recibe', values.recipientCity, 'request-recipient-city'],
    ['provincia de quien recibe', values.recipientProvince, 'request-recipient-province'],
  ]
  const missingPartyField = requiredPartyFields.find(([, value]) => !value.trim())
  if (missingPartyField)
    return { message: `Completa el ${missingPartyField[0]}.`, fieldId: missingPartyField[2] }
  if (!/^\S+@\S+\.\S+$/.test(values.contactEmail))
    return { message: 'Escribe un correo electrónico válido.', fieldId: 'request-contact-email' }
  if (!/^\S+@\S+\.\S+$/.test(values.recipientEmail))
    return {
      message: 'Escribe un correo válido para quien recibe.',
      fieldId: 'request-recipient-email',
    }
  const requiredFiscalFields: Array<[string, string, string]> =
    values.billingPayer === 'manual'
      ? [
          ['nombre o razón social', values.billingClient.fullName, 'request-billing-name'],
          ['NIF/CIF', values.billingClient.nif, 'request-billing-nif'],
          ['dirección fiscal', values.billingClient.address, 'request-billing-address'],
          ['código postal', values.billingClient.postalCode, 'request-billing-postal-code'],
          ['ciudad', values.billingClient.city, 'request-billing-city'],
          ['correo del pagador', values.billingClient.email, 'request-billing-email'],
          ['teléfono del pagador', values.billingClient.phone, 'request-billing-phone'],
        ]
      : []
  const missingFiscalField = requiredFiscalFields.find(([, value]) => !value.trim())
  if (missingFiscalField)
    return {
      message: `Completa los datos fiscales: ${missingFiscalField[0]}.`,
      fieldId: missingFiscalField[2],
    }
  if (values.billingPayer === 'manual' && !/^\S+@\S+\.\S+$/.test(values.billingClient.email))
    return {
      message: 'Escribe un correo válido para el pagador.',
      fieldId: 'request-billing-email',
    }
  return { message: '' }
}
