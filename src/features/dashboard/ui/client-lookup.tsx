import type { Client } from '@/shared/types'

import { loadClientPage } from '../application/paginated-lists'
import { DirectoryLookup } from './directory-lookup'

async function searchClients(query: string) {
  const result = await loadClientPage({ query, sort: 'name', direction: 'asc', page: 1 })
  return result.items.slice(0, 5)
}

export function ClientLookup({
  label,
  onSelect,
}: {
  label: string
  onSelect: (client: Client) => void
}) {
  return (
    <DirectoryLookup
      label={label}
      itemName="clientes"
      search={searchClients}
      describe={(client) => [client.fullName, client.nif].filter(Boolean).join(' · ')}
      onSelect={onSelect}
    />
  )
}
