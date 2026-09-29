import { describe, expect, it } from 'vitest'

import { validateOptionalClientAccountPassword } from './anonymous-client-account'

describe('validateOptionalClientAccountPassword', () => {
  it('requires a password of at least eight characters', () => {
    expect(validateOptionalClientAccountPassword('short', 'short')).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    )
  })

  it('requires matching password confirmation', () => {
    expect(validateOptionalClientAccountPassword('password-123', 'password-456')).toBe(
      'Las contraseñas no coinciden.',
    )
  })

  it('accepts a matching password of sufficient length', () => {
    expect(validateOptionalClientAccountPassword('password-123', 'password-123')).toBe('')
  })
})
