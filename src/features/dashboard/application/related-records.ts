import type { Client, ClientInvoice, Letter } from '@/shared/types'

const normalized = (value: string) => value.trim().toLocaleLowerCase()

/** Resolves the client attached to a letter, preferring its fiscal invoice link. */
export function findClientForLetter(
  letter: Letter,
  invoices: ClientInvoice[],
  clients: Client[],
): Client | undefined {
  const invoice = invoices.find((item) => item.letterId === letter.id)
  if (invoice) return clients.find((client) => client.id === invoice.clientId)

  const billingName = normalized(letter.billingClient.fullName)
  if (!billingName) return undefined
  return clients.find((client) => normalized(client.fullName) === billingName)
}
