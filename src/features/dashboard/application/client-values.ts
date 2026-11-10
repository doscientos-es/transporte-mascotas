import type { Client, InvoiceClientInput } from '@/shared/types'

export function invoiceClientFromSaved(client: Client): InvoiceClientInput {
  return {
    fullName: client.fullName,
    nif: client.nif,
    email: client.email,
    phone: client.phone,
    address: client.address,
    postalCode: client.postalCode,
    city: client.city,
  }
}
