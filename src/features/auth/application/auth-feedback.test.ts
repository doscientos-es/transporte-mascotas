import { describe, expect, it } from 'vitest'

import { getAuthFeedback } from './auth-feedback'

describe('getAuthFeedback', () => {
  it('offers a direct login action when the account already exists', () => {
    expect(
      getAuthFeedback(
        { code: 'user_already_exists', message: 'User already registered' },
        'signup',
      ),
    ).toEqual({
      tone: 'info',
      message: 'Esta cuenta ya está registrada. Inicia sesión para continuar.',
      action: 'login',
    })
  })

  it.each([
    [
      { message: 'Too many requests' },
      'Hemos recibido demasiados intentos. Espera unos minutos antes de volver a intentarlo.',
    ],
    [{ code: 'invalid_credentials' }, 'El correo o la contraseña no son correctos.'],
    [
      { code: 'email_not_confirmed' },
      'Confirma el correo que te enviamos antes de iniciar sesión.',
    ],
    [
      { message: 'Password is too weak' },
      'La contraseña no cumple los requisitos de seguridad. Prueba con otra distinta.',
    ],
    [{ code: 'email_address_invalid' }, 'Escribe un correo electrónico válido.'],
    [
      { message: 'Signups not allowed' },
      'El registro no está disponible ahora. Si necesitas acceso, contacta con el equipo.',
    ],
    [
      { status: 503 },
      'El servicio de acceso no está disponible temporalmente. Prueba de nuevo en unos minutos.',
    ],
  ])('explains known authentication failures: %#', (error, message) => {
    expect(getAuthFeedback(error, 'signup').message).toBe(message)
  })

  it('keeps unknown failures generic and appropriate to the current mode', () => {
    expect(getAuthFeedback({}, 'login').message).toBe(
      'No hemos podido iniciar sesión. Revisa tus datos e inténtalo de nuevo.',
    )
    expect(getAuthFeedback({}, 'signup').message).toBe(
      'No hemos podido crear la cuenta. Revisa los datos e inténtalo de nuevo.',
    )
  })
})
