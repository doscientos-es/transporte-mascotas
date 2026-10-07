import { Button, Card, CardContent } from '@doscientos/ui'
import { CalendarDays, CheckCircle2, CreditCard, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { ensureAnonymousClientSession, OptionalClientAccountCard } from '@/features/auth'
import {
  defaultTransportBoxCatalog,
  type TransportBoxCatalog,
} from '@/shared/application/transport-boxes'
import { AUTH_PATHS } from '@/shared/constants/auth-paths'
import { loadTransportBoxCatalog } from '@/shared/infrastructure/transport-pricing'
import type { UpcomingRoute } from '@/shared/types'
import { BrandLogo } from '@/shared/ui/brand-logo'

import {
  createTransportRequest,
  loadPublicUpcomingRoutes,
  payTransportRequest,
} from '../application/transport-requests'
import { ClientRequestForm, type RequestFormValues } from './client-request-form'
import { submitPaymentForm } from './submit-payment-form'

type CreatedRequest = { id: string; contact: RequestFormValues }

export function PublicTransportRequestPage() {
  const [routes, setRoutes] = useState<UpcomingRoute[]>([])
  const [boxCatalog, setBoxCatalog] = useState<TransportBoxCatalog>(defaultTransportBoxCatalog)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<CreatedRequest | null>(null)
  const [accountResult, setAccountResult] = useState<'created' | 'confirmation_pending' | null>(
    null,
  )
  const [paying, setPaying] = useState(false)
  const initialRouteId = new URLSearchParams(window.location.search).get('ruta') ?? undefined

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextRoutes, nextBoxCatalog] = await Promise.all([
        loadPublicUpcomingRoutes(),
        loadTransportBoxCatalog(),
      ])
      setRoutes(nextRoutes)
      setBoxCatalog(nextBoxCatalog)
    } catch {
      setError('No hemos podido cargar las próximas salidas. Vuelve a intentarlo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function submitRequest(values: RequestFormValues) {
    await ensureAnonymousClientSession({
      displayName: values.contactName,
      phone: values.contactPhone,
    })
    const id = await createTransportRequest(values)
    setCreated({ id, contact: values })
  }

  async function pay() {
    if (!created) return
    setPaying(true)
    setError('')
    try {
      submitPaymentForm(await payTransportRequest(created.id))
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Tu solicitud está guardada, pero no hemos podido abrir el pago. Reinténtalo.',
      )
      setPaying(false)
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-[960px] gap-5 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <BrandLogo className="h-14.5 w-18 object-contain" />
        <a className="auth-flow-link" href={AUTH_PATHS.clientAccess}>
          ¿Ya tienes cuenta? Accede
        </a>
      </header>

      {error && (
        <div className="inline-feedback is-error" role="alert">
          <p>{error}</p>
          {created ? (
            <Button type="button" onClick={() => void pay()} disabled={paying}>
              <CreditCard size={16} /> Reintentar pago
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? 'is-spinning' : ''} size={16} /> Reintentar
            </Button>
          )}
        </div>
      )}

      {!created && loading && !routes.length && (
        <Card className="invoice-empty" aria-busy="true">
          <CardContent>
            <RefreshCw className="is-spinning" size={22} />
            <div>
              <h3>Cargando próximas salidas…</h3>
            </div>
          </CardContent>
        </Card>
      )}

      {!created && !loading && !routes.length && !error && (
        <Card className="invoice-empty">
          <CardContent>
            <CalendarDays size={22} />
            <div>
              <h3>No hay salidas publicadas</h3>
              <p>En cuanto programemos nuevas salidas podrás solicitar tu transporte aquí.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!created && routes.length > 0 && (
        <ClientRequestForm
          routes={routes}
          contactName=""
          contactPhone=""
          contactEmail=""
          onSubmit={submitRequest}
          onCancel={() => window.location.assign(AUTH_PATHS.clientAccess)}
          boxCatalog={boxCatalog}
          initialRouteId={initialRouteId}
        />
      )}

      {created && !accountResult && (
        <OptionalClientAccountCard
          displayName={created.contact.contactName}
          email={created.contact.contactEmail}
          phone={created.contact.contactPhone}
          title="Solicitud guardada. ¿Quieres crear una cuenta?"
          description="Es opcional. Con una cuenta podrás seguir el transporte y guardar tus mascotas desde cualquier dispositivo."
          skipLabel={paying ? 'Abriendo pago…' : 'Continuar al pago sin cuenta'}
          busy={paying}
          onSkip={() => void pay()}
          onCreated={setAccountResult}
        />
      )}

      {created && accountResult && (
        <div className="inline-feedback" aria-live="polite">
          <p>
            <CheckCircle2 size={16} />{' '}
            {accountResult === 'created'
              ? 'Cuenta creada. Ya puedes completar el pago.'
              : 'Te hemos enviado un correo para confirmar tu cuenta. Mientras tanto, puedes completar el pago.'}
          </p>
          <Button type="button" onClick={() => void pay()} disabled={paying}>
            <CreditCard size={16} /> {paying ? 'Abriendo pago…' : 'Continuar al pago'}
          </Button>
        </div>
      )}
    </main>
  )
}
