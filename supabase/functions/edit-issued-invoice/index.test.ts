import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAdmin, rest, persist, upload } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rest: vi.fn(),
  persist: vi.fn(),
  upload: vi.fn(),
}))
vi.mock('../_shared/supabase.ts', () => ({
  requireAdmin,
  rest,
  corsHeaders: {},
  json: (body: unknown, status = 200) => Response.json(body, { status }),
}))
vi.mock('../_shared/invoice-document.ts', () => ({
  persistIssuedInvoiceDocument: persist,
  uploadInvoiceRevision: upload,
}))

let handler: (request: Request) => Promise<Response>
const invoiceId = '11111111-1111-4111-8111-111111111111'
const snapshot = {
  number: 'F-2026-000819',
  total_amount: 121,
  payment_method: 'Tarjeta',
  concept: 'Antes',
}
const input = {
  invoiceId,
  expectedSnapshot: snapshot,
  client: {
    fullName: ' Cliente ',
    nif: 'NIF',
    address: 'Calle',
    postalCode: '08001',
    city: 'Barcelona',
    email: '',
    phone: '',
  },
  concept: 'Después',
  operationDate: '2026-11-01',
}
const request = (body: unknown = input) =>
  new Request('https://example.invalid', { method: 'POST', body: JSON.stringify(body) })

beforeEach(async () => {
  vi.resetAllMocks()
  vi.resetModules()
  vi.stubGlobal('Deno', {
    serve: (callback: typeof handler) => {
      handler = callback
    },
  })
  requireAdmin.mockResolvedValue('admin')
  rest
    .mockResolvedValueOnce(
      Response.json([
        {
          id: 'issued',
          invoice_draft_id: invoiceId,
          issued_at: '2026-11-01',
          fiscal_snapshot: snapshot,
        },
      ]),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  upload.mockResolvedValue({ path: 'issued/revisions/id/invoice.pdf', fileName: 'invoice.pdf' })
  await import('./index.ts')
})
afterEach(() => vi.unstubAllGlobals())

describe('edit invoice endpoint', () => {
  it('rejects unauthorized users and invalid fiscal data', async () => {
    requireAdmin.mockRejectedValueOnce(new Error('No autenticado.'))
    expect((await handler(request())).status).toBe(401)
    expect(
      (await handler(request({ ...input, client: { ...input.client, nif: '' } }))).status,
    ).toBe(400)
    expect(rest).not.toHaveBeenCalled()
  })

  it('saves the previous document, renders the revision and atomically submits unchanged payment data', async () => {
    expect((await handler(request())).status).toBe(200)
    expect(persist).toHaveBeenCalledWith(invoiceId, 'admin')
    expect(persist.mock.invocationCallOrder[0]).toBeLessThan(upload.mock.invocationCallOrder[0])
    const updated = upload.mock.calls[0][0].fiscal_snapshot
    expect(updated).toMatchObject({
      number: snapshot.number,
      total_amount: 121,
      payment_method: 'Tarjeta',
      concept: 'Después',
      client: { fullName: 'Cliente' },
    })
    const [path, options] = rest.mock.calls[1]
    expect(path).toBe('rpc/edit_issued_invoice')
    expect(JSON.parse(options.body)).toMatchObject({
      p_actor_id: 'admin',
      p_expected_snapshot: snapshot,
      p_snapshot: updated,
    })
  })

  it('does not commit if generating the PDF fails', async () => {
    upload.mockRejectedValue(new Error('Storage unavailable'))
    expect((await handler(request())).status).toBe(500)
    expect(rest).toHaveBeenCalledTimes(1)
  })

  it('reports an unsuccessful commit rather than claiming a stale edit succeeded', async () => {
    rest
      .mockReset()
      .mockResolvedValueOnce(
        Response.json([{ id: 'issued', invoice_draft_id: invoiceId, fiscal_snapshot: snapshot }]),
      )
      .mockRejectedValueOnce(new Error('conflict'))
    expect((await handler(request())).status).toBe(500)
  })
})
