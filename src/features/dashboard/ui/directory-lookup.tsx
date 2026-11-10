import { Button, Input, Label } from '@doscientos/ui'
import { useEffect, useState } from 'react'

export function DirectoryLookup<Item extends { id: string }>({
  label,
  itemName,
  search,
  describe,
  onSelect,
}: {
  label: string
  itemName: string
  search: (query: string) => Promise<Item[]>
  describe: (item: Item) => string
  onSelect: (item: Item) => void
}) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [status, setStatus] = useState<'idle' | 'searching' | 'empty' | 'failed'>('idle')

  useEffect(() => {
    let active = true
    setItems([])
    if (!query.trim()) {
      setStatus('idle')
      return
    }
    setStatus('searching')
    const timeout = window.setTimeout(() => {
      void search(query.trim())
        .then((result) => {
          if (!active) return
          setItems(result)
          setStatus(result.length ? 'idle' : 'empty')
        })
        .catch(() => {
          if (active) setStatus('failed')
        })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [query, search])

  return (
    <div className="grid gap-2">
      <Label>
        {label}
        <Input
          type="search"
          value={query}
          onChange={(event) => {
            setItems([])
            setQuery(event.target.value)
          }}
          placeholder="Nombre o NIF/CIF"
        />
      </Label>
      {status === 'searching' && <output>Buscando {itemName}…</output>}
      {status === 'empty' && (
        <output>No se han encontrado {itemName}. Puedes rellenar los datos.</output>
      )}
      {status === 'failed' && (
        <output>No se han podido buscar {itemName}. Puedes rellenar los datos.</output>
      )}
      {items.length > 0 && (
        <div className="grid gap-2" aria-label={`${itemName} encontrados`}>
          {items.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="outline"
              className="h-auto min-h-9 justify-start text-left whitespace-normal"
              onClick={() => {
                onSelect(item)
                setItems([])
                setQuery('')
                setStatus('idle')
              }}
            >
              {describe(item)}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
