import { describe, expect, it } from 'vitest'

import { sessionUserId } from './session-user-id'

describe('sessionUserId', () => {
  it('keeps the same identity when a session is refreshed', () => {
    const previousSession = { user: { id: 'user-1' }, access_token: 'old-token' }
    const refreshedSession = { user: { id: 'user-1' }, access_token: 'new-token' }

    expect(sessionUserId(refreshedSession)).toBe(sessionUserId(previousSession))
  })

  it('returns null when there is no authenticated session', () => {
    expect(sessionUserId(null)).toBeNull()
  })
})
