import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadPaymentRedirectForm } from './payment-redirect'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('loadPaymentRedirectForm', () => {
  it('requests the signed payment fields as JSON', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.example')
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          endpoint: 'https://gateway.example/pay',
          fields: { Ds_Signature: 'sig' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadPaymentRedirectForm('123e4567-e89b-12d3-a456-426614174000')).resolves.toEqual({
      endpoint: 'https://gateway.example/pay',
      fields: { Ds_Signature: 'sig' },
    })
    const call = fetchMock.mock.calls.at(0)
    if (!call) throw new Error('No se ha realizado la petición.')
    const url = new URL(call[0] as URL)
    expect(url.pathname).toBe('/functions/v1/payment-redirect')
    expect(url.searchParams.get('format')).toBe('json')
  })

  it('preserves the transport payment kind', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.example')
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ endpoint: 'https://gateway.example/pay', fields: {} })),
      )
    vi.stubGlobal('fetch', fetchMock)

    await loadPaymentRedirectForm('123e4567-e89b-12d3-a456-426614174000', 'transport')

    const call = fetchMock.mock.calls.at(0)
    if (!call) throw new Error('No se ha realizado la petición.')
    expect(new URL(call[0] as URL).searchParams.get('kind')).toBe('transport')
  })

  it('rejects malformed tokens without making a request', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadPaymentRedirectForm('invalid')).rejects.toThrow('Enlace de pago no válido.')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
