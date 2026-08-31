import { describe, expect, it } from 'vitest'

import { requestErrorMessage } from './request-errors'

describe('requestErrorMessage', () => {
  const fallback = 'No se ha podido enviar la solicitud. Vuelve a intentarlo.'

  it('keeps deliberate API validation feedback', () => {
    expect(
      requestErrorMessage({ code: 'P0001', message: 'La salida ya no está disponible' }, fallback),
    ).toBe('La salida ya no está disponible')
  })

  it('hides database and network implementation details', () => {
    expect(
      requestErrorMessage(
        { code: '22P02', message: 'invalid input syntax for type numeric' },
        fallback,
      ),
    ).toBe(fallback)
    expect(requestErrorMessage(new TypeError('Failed to fetch'), fallback)).toBe(fallback)
  })
})
