import { Spinner } from '@doscientos/ui'
import { Check, Circle, TriangleAlert } from 'lucide-react'

import type { DrivingProgress } from '../application/driving-times'

type Props = {
  /** Latest phase reported by the calculation; `null` before it reports anything. */
  progress: DrivingProgress | null
  /** Adds a last "saving" step, for calculations whose result is stored afterwards. */
  withSaving?: boolean
}

type StepState = 'done' | 'active' | 'pending'

const phaseStep: Record<DrivingProgress['phase'], number> = {
  locating: 0,
  google: 1,
  fallback: 1,
  saving: 2,
}

/** Tells, step by step, what a route calculation is doing and when Google had to be replaced. */
export function CalculationProgress({ progress, withSaving = false }: Props) {
  const current = progress ? phaseStep[progress.phase] : 0
  const fallback = progress?.phase === 'fallback'
  const steps = [
    {
      label:
        progress?.phase === 'locating' && progress.total > 1
          ? `Localizando las paradas (${progress.done}/${progress.total})`
          : 'Localizando las paradas',
    },
    {
      label: fallback
        ? 'Google Maps no responde: se usa un servicio alternativo, menos preciso'
        : 'Calculando trayectos con Google Maps',
      warning: fallback,
    },
    ...(withSaving ? [{ label: 'Guardando los tiempos' }] : []),
  ]

  return (
    <div className="calc-steps" aria-live="polite" aria-busy="true">
      <ol>
        {steps.map((step, index) => {
          const state: StepState =
            index < current ? 'done' : index === current ? 'active' : 'pending'
          const warning = Boolean(step.warning) && state !== 'pending'
          return (
            <li key={index} className={`is-${state}${warning ? ' is-warning' : ''}`}>
              <span className="calc-step-icon" aria-hidden="true">
                {state === 'done' ? (
                  <Check />
                ) : state === 'active' ? (
                  warning ? (
                    <TriangleAlert />
                  ) : (
                    <Spinner />
                  )
                ) : (
                  <Circle />
                )}
              </span>
              <span>{step.label}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
