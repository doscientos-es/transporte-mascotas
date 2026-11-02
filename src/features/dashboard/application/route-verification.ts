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
 * Compares the saved driving minutes of each leg with a verification. Small gaps (a few
 * minutes, or under 8% of the trip) count as a match, since rounding alone produces them.
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
  return {
    googleMinutes,
    savedMinutes,
    differenceMinutes,
    matches: Math.abs(differenceMinutes) <= Math.max(3, googleMinutes * 0.08),
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
