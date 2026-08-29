import { Download, Share2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { shouldOfferPwaInstallation } from '@/shared/application/pwa-install'

const DISMISS_KEY = 'kache-envios:pwa-install-dismissed'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function wasDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** Offers native installation or the required Safari instructions on a first visit. */
export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(true)
  const [standalone, setStandalone] = useState(true)
  const [ios, setIos] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setStandalone(isStandalone())
    setIos(isIos())
    setDismissed(wasDismissed())

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Keep the notice dismissible when storage is unavailable.
    }
    setDismissed(true)
  }

  const install = async () => {
    if (!installEvent) return
    setPending(true)
    try {
      await installEvent.prompt()
      const choice = await installEvent.userChoice
      if (choice.outcome === 'accepted') setStandalone(true)
      setInstallEvent(null)
    } finally {
      setPending(false)
    }
  }

  const visible = shouldOfferPwaInstallation({
    isDismissed: dismissed,
    isIos: ios,
    isStandalone: standalone,
    canPrompt: installEvent !== null,
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
