import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAdmin, rest, persistDocument } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rest: vi.fn(),
  persistDocument: vi.fn(),
}))
vi.mock('../_shared/supabase.ts', () => ({
  requireAdmin,
  rest,
  corsHeaders: {},
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}))
vi.mock('../_shared/invoice-document.ts', () => ({ persistIssuedInvoiceDocument: persistDocument }))

let handler: (request: Request) => Promise<Response>
const input = {
  id: '11111111-1111-4111-8111-111111111111',
  client: { fullName: 'Test', nif: 'TEST', address: 'Test', postalCode: '08001', city: 'Test' },
  concept: 'Extra',
  total: 121,
  operationDate: '2026-01-10',
  paymentMethod: 'Tarjeta',
}
const request = (body: unknown = input) =>
  new Request('https://example.invalid', {
    method: 'POST',
    body: JSON.stringify(body),
  })

beforeEach(async () => {
  vi.resetAllMocks()
  vi.resetModules()
  vi.stubGlobal('Deno', {
    serve: (callback: typeof handler) => {
      handler = callback
    },
    env: {
      get: (key: string) =>
        ({
          INVOICE_ISSUER_NAME: 'Test issuer',
          INVOICE_ISSUER_TAX_ID: 'TEST',
          INVOICE_ISSUER_ADDRESS: 'Test address',
        })[key],
    },
  })
  requireAdmin.mockResolvedValue('verified-admin')
  rest.mockResolvedValue(Response.json({ invoiceDraftId: input.id, issuedInvoiceId: 'issued' }))
  await import('./index.ts')
})
afterEach(() => vi.unstubAllGlobals())

describe('free invoice endpoint', () => {
  it.each([
    ['No autenticado.', 401],
    ['No tienes permisos para generar pagos.', 403],
  ])('blocks unauthorized creation (%s)', async (message, status) => {
    requireAdmin.mockRejectedValue(new Error(message))
    expect((await handler(request())).status).toBe(status)
    expect(rest).not.toHaveBeenCalled()
    expect(persistDocument).not.toHaveBeenCalled()
  })

  it.each([
    null,
    { ...input, id: 'invalid' },
    { ...input, total: -1 },
    { ...input, total: 1.001 },
    { ...input, paymentMethod: 'other' },
  ])('rejects malformed input before creating records', async (body) => {
    expect((await handler(request(body))).status).toBe(400)
    expect(rest).not.toHaveBeenCalled()
  })

  it('takes actor and issuer only from the server, not the submitted body', async () => {
    const response = await handler(
      request({ ...input, actorId: 'untrusted', issuer: { name: 'untrusted' } }),
    )
    expect(response.status).toBe(200)
    const [path, options] = rest.mock.calls[0]
    expect(path).toBe('rpc/create_paid_manual_invoice')
    expect(JSON.parse(options.body)).toEqual({
      p_invoice_id: input.id,
      p_actor_id: 'verified-admin',
      p_client: input.client,
      p_concept: 'Extra',
      p_total: 121,
      p_operation_date: input.operationDate,
      p_payment_method: 'Tarjeta',
      p_issuer_snapshot: { name: 'Test issuer', taxId: 'TEST', address: 'Test address' },
    })
    expect(persistDocument).toHaveBeenCalledWith(input.id, 'verified-admin')
  })

  it('returns success after committed issuance even if PDF persistence fails', async () => {
    persistDocument.mockRejectedValue(new Error('Storage unavailable'))
    const response = await handler(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ invoiceDraftId: input.id, documentPending: true })
    expect(rest).toHaveBeenCalledTimes(1)
  })

  it('does not generate a PDF when the atomic database operation fails', async () => {
    rest.mockRejectedValue(new Error('Database unavailable'))
    expect((await handler(request())).status).toBe(500)
    expect(persistDocument).not.toHaveBeenCalled()
  })
})
