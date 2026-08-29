export type PwaInstallAvailability = {
  isDismissed: boolean
  isIos: boolean
  isStandalone: boolean
  canPrompt: boolean
}

/** Keeps the install call to action limited to browsers that can complete it. */
export function shouldOfferPwaInstallation({
  isDismissed,
  isIos,
  isStandalone,
  canPrompt,
}: PwaInstallAvailability) {
  return !isStandalone && !isDismissed && (isIos || canPrompt)
}
