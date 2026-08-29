import { usePageMetadata } from './use-page-metadata'

export function NotFoundPage({ homeHref }: { homeHref: string }) {
  usePageMetadata('Página no encontrada', 'La página que buscas no está disponible.')
  return (
    <main className="loading-screen app-state">
      <div>
        <h1>Página no encontrada</h1>
        <p>La dirección no existe o ya no está disponible.</p>
        <a href={homeHref}>Ir al inicio</a>
      </div>
    </main>
  )
}
