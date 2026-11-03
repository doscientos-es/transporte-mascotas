import type { DrivingLeg, RouteVerification } from './driving-times'

/** Short text for a leg on the map, e.g. `18 min · 14,2 km`. */
export function legLabel(leg: DrivingLeg) {
  const duration =
    leg.minutes >= 60
      ? `${Math.floor(leg.minutes / 60)} h ${String(leg.minutes % 60).padStart(2, '0')} min`
      : `${leg.minutes} min`
  if (leg.meters === undefined) return duration
  const kilometers = leg.meters / 1000
  return `${duration} · ${kilometers.toLocaleString('es-ES', {
    maximumFractionDigits: kilometers < 10 ? 1 : 0,
  })} km`
}

export type VerificationSummary = {
  googleMinutes: number
  savedMinutes: number
  /** Google minus saved: positive means Google expects a longer drive. */
  differenceMinutes: number
  /** True when the saved times are close enough to Google's to need no action. */
  matches: boolean
  kilometers?: number
  legs: Array<{ googleMinutes: number; savedMinutes: number; legLabel: string }>
}

/**
 * Checks both each leg and the total: opposite leg errors must not cancel each other out.
 * Allow at most 3 minutes or 8% of Google's duration, whichever is greater.
 */
export function summarizeVerification(
  verification: RouteVerification,
  savedLegMinutes: number[],
): VerificationSummary | null {
  if (verification.legs.length === 0 || verification.legs.length !== savedLegMinutes.length)
    return null
  const googleMinutes = verification.legs.reduce((total, leg) => total + leg.minutes, 0)
  const savedMinutes = savedLegMinutes.reduce((total, minutes) => total + minutes, 0)
  const differenceMinutes = googleMinutes - savedMinutes
  const hasDistance = verification.legs.every((leg) => leg.meters !== undefined)
  const withinTolerance = (expected: number, saved: number) =>
    Math.abs(expected - saved) <= Math.max(3, expected * 0.08)
  return {
    googleMinutes,
    savedMinutes,
    differenceMinutes,
    matches:
      withinTolerance(googleMinutes, savedMinutes) &&
      verification.legs.every((leg, index) => withinTolerance(leg.minutes, savedLegMinutes[index])),
    kilometers: hasDistance
      ? verification.legs.reduce((total, leg) => total + (leg.meters ?? 0), 0) / 1000
      : undefined,
    legs: verification.legs.map((leg, index) => ({
      googleMinutes: leg.minutes,
      savedMinutes: savedLegMinutes[index],
      legLabel: legLabel(leg),
    })),
  }
}
