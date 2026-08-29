import { useEffect } from 'react'

export function usePageMetadata(title: string, description: string) {
  useEffect(() => {
    document.title = `${title} · Kache Envíos`
    document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  }, [description, title])
}
