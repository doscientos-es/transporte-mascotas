import { Button } from '@doscientos/ui'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { loadPaymentRedirectForm } from '../application/payment-redirect'

export function PaymentLaunchPage() {
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const [paymentForm, setPaymentForm] = useState<Awaited<
    ReturnType<typeof loadPaymentRedirectForm>
  > | null>(null)

  useEffect(() => {
    let active = true
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token') ?? ''
    const kind = params.get('kind') === 'transport' ? 'transport' : undefined
    setError('')
    setPaymentForm(null)

    void loadPaymentRedirectForm(token, kind)
      .then((form) => {
        if (active) setPaymentForm(form)
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

  if (paymentForm)
    return (
      <main className="loading-screen">
        <section className="route-error-card">
          <h1>Continuar con el pago</h1>
          <p className="route-error-copy">
            Pulsa el botón para abrir la pasarela segura de CaixaBank.
          </p>
          <form action={paymentForm.endpoint} method="post">
            {Object.entries(paymentForm.fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <div className="route-error-actions">
              <Button type="submit">Ir a CaixaBank</Button>
            </div>
          </form>
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
