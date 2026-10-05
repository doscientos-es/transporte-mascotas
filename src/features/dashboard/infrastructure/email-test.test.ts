import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('@/shared/infrastructure/supabase', () => ({
  requireSupabase: () => ({ functions: { invoke } }),
}))

import { sendEmailTest } from './email-test'

describe('sendEmailTest', () => {
  beforeEach(() => invoke.mockReset())

  it('invokes the authenticated email test and returns its recipient', async () => {
    invoke.mockResolvedValue({
      data: { sent: true, email: 'admin@example.test' },
      error: null,
    })

    await expect(sendEmailTest()).resolves.toEqual({ email: 'admin@example.test' })
    expect(invoke).toHaveBeenCalledWith('send-test-email', { body: {} })
  })

  it('surfaces errors returned by the Edge Function', async () => {
    invoke.mockResolvedValue({ data: { error: 'El email no está configurado.' }, error: null })

    await expect(sendEmailTest()).rejects.toThrow('El email no está configurado.')
  })

  it('uses the response detail when the Edge Function request fails', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'Resend rechazó el envío.' })) },
    })

    await expect(sendEmailTest()).rejects.toThrow('Resend rechazó el envío.')
  })

  it('includes the HTTP status when the Edge Function returns a non-JSON error', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: new Response('Not found', { status: 404 }) },
    })

    await expect(sendEmailTest()).rejects.toThrow(
      'No se ha podido enviar el email de prueba. (HTTP 404)',
    )
  })
})
