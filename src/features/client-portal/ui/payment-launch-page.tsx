import { Button } from '@doscientos/ui'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { loadPaymentRedirectForm } from '../application/payment-redirect'
import { submitPaymentForm } from './submit-payment-form'

export function PaymentLaunchPage() {
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token') ?? ''
    const kind = params.get('kind') === 'transport' ? 'transport' : undefined
    setError('')

    void loadPaymentRedirectForm(token, kind)
      .then((form) => {
        if (active) submitPaymentForm(form)
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se ha podido abrir el pago. Contacta con Kache Envíos.',
          )
      })

    return () => {
      active = false
    }
  }, [attempt])

  if (error)
    return (
      <main className="loading-screen route-error-state" role="alert">
        <section className="route-error-card">
          <div className="route-error-icon" aria-hidden="true">
            <CircleAlert size={28} />
          </div>
          <h1>No se ha podido abrir el pago</h1>
          <p className="route-error-copy">{error}</p>
          <div className="route-error-actions">
            <Button onClick={() => setAttempt((value) => value + 1)}>
              <RefreshCw /> Reintentar
            </Button>
          </div>
        </section>
      </main>
    )

  return (
    <main className="loading-screen" aria-live="polite">
      <RefreshCw className="is-spinning" size={22} />
      <p>Conectando con la pasarela de pago…</p>
    </main>
  )
}
