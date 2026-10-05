import type { InvoiceClientInput, TransportRequest } from '@/shared/types'

type RequestPayerValues = Pick<
  TransportRequest,
  | 'billingPayer'
  | 'contactName'
  | 'senderNif'
  | 'contactEmail'
  | 'contactPhone'
  | 'senderAddress'
  | 'senderPostalCode'
  | 'senderCity'
  | 'recipientName'
  | 'recipientNif'
  | 'recipientEmail'
  | 'recipientPhone'
  | 'recipientAddress'
  | 'recipientPostalCode'
  | 'recipientCity'
>

export function payerIdentity(values: RequestPayerValues): Partial<InvoiceClientInput> {
  if (values.billingPayer === 'remitente')
    return {
      fullName: values.contactName,
      nif: values.senderNif,
      email: values.contactEmail,
      phone: values.contactPhone,
      address: values.senderAddress,
      postalCode: values.senderPostalCode,
      city: values.senderCity,
    }
  if (values.billingPayer === 'destinatario')
    return {
      fullName: values.recipientName,
      nif: values.recipientNif,
      email: values.recipientEmail,
      phone: values.recipientPhone,
      address: values.recipientAddress,
      postalCode: values.recipientPostalCode,
      city: values.recipientCity,
    }
  return {}
}
