import { usePwaInstallPrompt } from '@doscientos/pwa/react'
import { Download, Share2, X } from 'lucide-react'

const DISMISS_KEY = 'kache-envios:pwa-install-dismissed'

/** Offers native installation or the required Safari instructions on a first visit. */
export function PwaInstallPrompt() {
  const {
    dismiss,
    install,
    isIos: ios,
    pending,
    visible,
  } = usePwaInstallPrompt({
    storageKey: DISMISS_KEY,
  })
  if (!visible) return null

  return (
    <aside className="pwa-install-prompt" aria-label="Instalar Kache Envíos">
      <div className="pwa-install-icon" aria-hidden="true">
        {ios ? <Share2 size={20} /> : <Download size={20} />}
      </div>
      <div className="pwa-install-content">
        <strong>{ios ? 'Añade Kache Envíos a tu inicio' : 'Instala Kache Envíos'}</strong>
        <p>
          {ios
            ? 'En Safari, toca Compartir y elige «Añadir a pantalla de inicio» para usarlo como una app.'
            : 'Ábrelo como una app para acceder más rápido a tus transportes.'}
        </p>
      </div>
      <div className="pwa-install-actions">
        {!ios && (
          <button
            type="button"
            className="pwa-install-action"
            disabled={pending}
            onClick={() => void install()}
          >
            {pending ? 'Abriendo…' : 'Instalar'}
          </button>
        )}
        <button
          type="button"
          className="pwa-install-dismiss"
          onClick={dismiss}
          aria-label="Descartar aviso de instalación"
        >
          <X size={18} />
        </button>
      </div>
    </aside>
  )
}
