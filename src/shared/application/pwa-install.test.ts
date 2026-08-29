import { describe, expect, it } from 'vitest'

import { shouldOfferPwaInstallation } from './pwa-install'

describe('shouldOfferPwaInstallation', () => {
  it.each([
    [{ isDismissed: false, isIos: false, isStandalone: false, canPrompt: true }, true],
    [{ isDismissed: false, isIos: true, isStandalone: false, canPrompt: false }, true],
    [{ isDismissed: true, isIos: false, isStandalone: false, canPrompt: true }, false],
    [{ isDismissed: false, isIos: false, isStandalone: true, canPrompt: true }, false],
    [{ isDismissed: false, isIos: false, isStandalone: false, canPrompt: false }, false],
  ] as const)('returns %s when availability is %o', (availability, expected) => {
    expect(shouldOfferPwaInstallation(availability)).toBe(expected)
  })
})