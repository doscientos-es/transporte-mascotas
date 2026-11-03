import { Button } from '@doscientos/ui'
import { BadgeCheck, CircleAlert, TriangleAlert } from 'lucide-react'

import type { DrivingProgress, DrivingSource } from '../application/driving-times'
import type { VerificationSummary } from '../application/route-verification'
import { CalculationProgress } from './calculation-progress'

export type VerificationStatus =
  /** Waiting for Google's answer; `saving` adds the step of storing the result. */
  | { kind: 'checking'; progress: DrivingProgress | null; saving?: boolean }
  /** Nothing could be asked or calculated (Google not configured, offline...). */
  | { kind: 'unavailable' }
  | {
    kind: 'ready'
    source: DrivingSource
    calculatedAt: number
    summary: VerificationSummary
  }

type Props = {
  status: VerificationStatus
  /** Locality of every stop, to name each leg. */
  stopNames: string[]
  /** Offer to replace the saved times with Google's. */
  canApply: boolean
  applying: boolean
  onApply: () => void
}

const duration = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ''}`.trim()
    : `${minutes} min`

const clock = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

/** Says where the driving times come from and whether Google confirms the saved ones. */
export function RouteVerificationPanel({ status, stopNames, canApply, applying, onApply }: Props) {
  if (status.kind === 'checking') {
    return (
      <div className="route-verify is-checking-steps">
        <strong>Comprobando con Google Maps…</strong>
        <CalculationProgress progress={status.progress} withSaving={status.saving} />
      </div>
    )
  }

  if (status.kind === 'unavailable') {
    return (
      <div className="route-verify is-muted">
        <CircleAlert aria-hidden="true" />
        <div>
          <strong>Sin verificación de Google Maps</strong>
          <span>Los tiempos son una estimación y el mapa une las paradas en línea recta.</span>
        </div>
      </div>
    )
  }

  const { source, calculatedAt, summary } = status
  if (source !== 'google') {
    return (
      <div className="route-verify is-muted">
        <CircleAlert aria-hidden="true" />
        <div>
          <strong>Calculado con un servicio gratuito</strong>
          <span>Google Maps no ha respondido, así que los tiempos son aproximados.</span>
        </div>
      </div>
    )
  }

  const gap = Math.abs(summary.differenceMinutes)
  return (
    <div className={`route-verify ${summary.matches ? 'is-verified' : 'is-different'}`}>
      <div className="route-verify-head" aria-live="polite">
        {summary.matches ? <BadgeCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
        <div>
          <strong>
            {summary.matches
              ? 'Verificado con Google Maps'
              : gap === 0
                ? 'Hay diferencias entre tramos'
                : `Google calcula ${duration(gap)} ${summary.differenceMinutes > 0 ? 'más' : 'menos'}`}
          </strong>
          <span>
            {summary.matches
              ? 'Los tiempos guardados coinciden dentro del margen de tolerancia.'
              : `Guardado: ${duration(summary.savedMinutes)} · Google: ${duration(summary.googleMinutes)}.`}{' '}
            Comprobado a las {clock(calculatedAt)}.
          </span>
        </div>
      </div>
      <dl className="route-verify-totals">
        <div>
          <dt>Conducción</dt>
          <dd>{duration(summary.googleMinutes)}</dd>
        </div>
        {summary.kilometers !== undefined && (
          <div>
            <dt>Distancia</dt>
            <dd>{summary.kilometers.toLocaleString('es-ES', { maximumFractionDigits: 0 })} km</dd>
          </div>
        )}
        <div>
          <dt>Tramos</dt>
          <dd>{summary.legs.length}</dd>
        </div>
      </dl>
      <span>Sin tráfico en tiempo real; la conducción no incluye las paradas.</span>
      {!summary.matches && canApply && (
        <Button size="sm" onClick={onApply} disabled={applying}>
          {applying ? 'Aplicando…' : 'Usar tiempos de Google'}
        </Button>
      )}
      <details className="route-verify-legs">
        <summary>Ver tramos</summary>
        <ol>
          {summary.legs.map((leg, index) => (
            <li key={index}>
              <span>
                {stopNames[index] ?? index + 1} → {stopNames[index + 1] ?? index + 2}
              </span>
              <b>{leg.legLabel}</b>
              {leg.savedMinutes !== leg.googleMinutes && (
                <small>guardado: {duration(leg.savedMinutes)}</small>
              )}
            </li>
          ))}
        </ol>
      </details>
    </div>
  )
}
