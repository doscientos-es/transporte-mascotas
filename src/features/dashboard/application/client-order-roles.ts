import type { Client, Letter } from '@/shared/types'

export type ClientOrderRole = 'Enviador' | 'Recogedor' | 'Pagador'

type Party = { name: string; nif: string }

const normalize = (value: string) => value.trim().toLocaleLowerCase()
const normalizeNif = (value: string) => value.replace(/[\s.-]/g, '').toLocaleUpperCase()

function sameParty(client: Pick<Client, 'fullName' | 'nif'>, party: Party) {
  const clientNif = normalizeNif(client.nif)
  const partyNif = normalizeNif(party.nif)
  if (clientNif && partyNif) return clientNif === partyNif
  const name = normalize(party.name)
  return name !== '' && name === normalize(client.fullName)
}

function payerOf(letter: Letter): Party | null {
  const billing = letter.billingClient
  if (billing?.fullName.trim() || billing?.nif.trim())
    return { name: billing.fullName, nif: billing.nif }
  if (letter.billingPayer === 'remitente') return { name: letter.sender, nif: letter.senderNif }
  if (letter.billingPayer === 'destinatario')
    return { name: letter.recipient, nif: letter.recipientNif }
  return null
}

/** How a client took part in a letter: sender, recipient and/or payer. */
export function clientOrderRoles(
  client: Pick<Client, 'fullName' | 'nif'>,
  letter: Letter,
): ClientOrderRole[] {
  const roles: ClientOrderRole[] = []
  if (sameParty(client, { name: letter.sender, nif: letter.senderNif })) roles.push('Enviador')
  if (sameParty(client, { name: letter.recipient, nif: letter.recipientNif }))
    roles.push('Recogedor')
  const payer = payerOf(letter)
  if (payer && sameParty(client, payer)) roles.push('Pagador')
  return roles
}
