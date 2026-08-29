/** Registers after load so app startup and authentication remain the priority. */
export function registerPwaServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  const register = () => {
    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .catch(() => undefined)
  }

  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}