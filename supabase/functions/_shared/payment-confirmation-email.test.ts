import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  sendComplimentaryLetterConfirmation,
  sendInvoicePaymentConfirmation,
  sendTransportPaymentConfirmation,
} from './payment-confirmation-email.ts'

const mocks = vi.hoisted(() => ({
  rest: vi.fn(),
  load: vi.fn(),
  render: vi.fn(),
  persist: vi.fn(),
  fetchInvoice: vi.fn(),
  send: vi.fn(),
}))
vi.mock('./supabase.ts', () => ({ rest: mocks.rest }))
vi.mock('./carriage-letter-document.ts', () => ({
  loadCarriageLetter: mocks.load,
  renderCarriageLetter: mocks.render,
}))
vi.mock('./invoice-document.ts', () => ({
  persistIssuedInvoiceDocument: mocks.persist,
  fetchInvoiceDocument: mocks.fetchInvoice,
}))
vi.mock('./resend.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./resend.ts')>()),
  isEmailConfigured: () => true,
  senderAddress: () => 'team@example.test',
  sendEmail: mocks.send,
}))

const letter = {
  id: 'LETTER-1',
  service_date: '2026-12-10',
  sender_name: 'Ana',
  sender_email: 'ana@example.test',
  recipient_name: 'Luis',
  recipient_email: 'luis@example.test',
  origin_text: 'Madrid',
  destination_text: 'Valencia',
  origin_point: 'Punto Madrid',
  destination_point: 'Punto Valencia',
  origin_latitude: 40.1,
  origin_longitude: -3.1,
  destination_latitude: 39.2,
  destination_longitude: -0.2,
  animals: [],
}
const draft = {
  letter_id: letter.id,
  concept: 'Transporte',
  total_amount: '121',
  client_snapshot: { fullName: 'Ana', email: 'ana@example.test' },
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('Deno', { env: { get: () => undefined } })
  mocks.rest.mockImplementation(async (path: string) => {
    if (path.startsWith('transport_requests?')) return Response.json([{ letter_id: letter.id }])
    if (path.startsWith('invoice_drafts?')) return Response.json([draft])
    if (path.includes('invoice_draft_id')) return Response.json([{ invoice_draft_id: 'draft-1' }])
    if (path.startsWith('issued_invoices?')) return Response.json([{ number: '2026/1' }])
    throw new Error(`Unexpected request: ${path}`)
  })
  mocks.load.mockResolvedValue({ ...letter })
  mocks.render.mockResolvedValue({ fileName: 'letter.pdf', body: new Uint8Array([1]) })
  mocks.persist.mockResolvedValue({ file_name: 'invoice.pdf' })
  mocks.fetchInvoice.mockImplementation(async () => new Response(new Uint8Array([2])))
  mocks.send.mockResolvedValue('sent')
})
afterEach(() => vi.unstubAllGlobals())

describe('transport payment confirmations', () => {
  it('sends the payer invoice and pickup location, and only the letter and delivery location to the other party', async () => {
    await sendTransportPaymentConfirmation('request-1', 'invoice-1')
    expect(mocks.send).toHaveBeenCalledTimes(2)
    const payer = mocks.send.mock.calls.find(([email]) => email.to === 'ana@example.test')![0]
    const other = mocks.send.mock.calls.find(([email]) => email.to === 'luis@example.test')![0]
    expect(payer.attachments.map((item: { filename: string }) => item.filename)).toEqual([
      'invoice.pdf',
      'letter.pdf',
      'transporte-kache-envios.ics',
    ])
    expect(other.attachments.map((item: { filename: string }) => item.filename)).toEqual([
      'letter.pdf',
      'transporte-kache-envios.ics',
    ])
    expect(payer.text).toContain('Punto Madrid')
    expect(payer.text).toContain('40.1%2C-3.1')
    expect(payer.text).not.toContain('Punto Valencia')
    expect(other.text).toContain('Punto Valencia')
    expect(other.text).not.toContain('Punto Madrid')
    expect(other.text).not.toContain('Importe pagado')
    expect(other.text).toContain('hora exacta y más detalles')
    expect(other.html).toContain('hora exacta y más detalles')
    expect(payer.idempotencyKey).not.toBe(other.idempotencyKey)
  })

  it('handles recipient as payer, missing sender email, and a distinct fiscal payer', async () => {
    mocks.load.mockResolvedValue({ ...letter, sender_email: '' })
    mocks.rest.mockImplementation(async (path: string) =>
      path.startsWith('invoice_drafts?')
        ? Response.json([
            { ...draft, client_snapshot: { fullName: 'Luis', email: 'luis@example.test' } },
          ])
        : Response.json([{ number: '2026/1' }]),
    )
    await sendInvoicePaymentConfirmation('draft-1', 'invoice-1')
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.send.mock.calls[0][0].to).toBe('luis@example.test')
    expect(mocks.send.mock.calls[0][0].attachments[0].filename).toBe('invoice.pdf')

    mocks.send.mockClear()
    mocks.rest.mockImplementation(async (path: string) =>
      path.startsWith('invoice_drafts?')
        ? Response.json([
            { ...draft, client_snapshot: { fullName: 'Empresa', email: 'company@example.test' } },
          ])
        : Response.json([{ number: '2026/1' }]),
    )
    await sendInvoicePaymentConfirmation('draft-1', 'invoice-1')
    const company = mocks.send.mock.calls.find(([email]) => email.to === 'company@example.test')![0]
    expect(company.text).toContain('Punto Madrid')
    expect(company.text).toContain('Punto Valencia')
    expect(
      mocks.send.mock.calls.find(([email]) => email.to === 'luis@example.test')![0].attachments[0]
        .filename,
    ).toBe('letter.pdf')
  })

  it('deduplicates shared addresses and sends both locations with the invoice', async () => {
    mocks.load.mockResolvedValue({ ...letter, recipient_email: ' ANA@example.test ' })
    await sendInvoicePaymentConfirmation('draft-1', 'invoice-1')
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.send.mock.calls[0][0].text).toContain('Punto Madrid')
    expect(mocks.send.mock.calls[0][0].text).toContain('Punto Valencia')
    expect(mocks.send.mock.calls[0][0].attachments[0].filename).toBe('invoice.pdf')
  })

  it('sends complimentary letters without invoice and skips missing emails', async () => {
    mocks.load.mockResolvedValue({ ...letter, sender_email: '' })
    await sendComplimentaryLetterConfirmation('LETTER-1')
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.persist).not.toHaveBeenCalled()
    expect(mocks.send.mock.calls[0][0].text).not.toContain('pago correctamente')
    expect(mocks.send.mock.calls[0][0].attachments[0].filename).toBe('letter.pdf')
  })

  it('still emails the other party if the invoice cannot be prepared, and reports the failure', async () => {
    mocks.persist.mockRejectedValue(new Error('Invoice unavailable'))
    await expect(sendInvoicePaymentConfirmation('draft-1', 'invoice-1')).rejects.toThrow(
      'Invoice unavailable',
    )
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.send.mock.calls[0][0].to).toBe('luis@example.test')
  })

  it('rejects a mismatched transport invoice without sending private documents', async () => {
    mocks.rest.mockImplementation(async (path: string) => {
      if (path.startsWith('transport_requests?')) return Response.json([{ letter_id: 'different' }])
      if (path.startsWith('invoice_drafts?')) return Response.json([draft])
      return Response.json([{ invoice_draft_id: 'draft-1' }])
    })
    await expect(sendTransportPaymentConfirmation('request-1', 'invoice-1')).rejects.toThrow(
      'no corresponde',
    )
    expect(mocks.send).not.toHaveBeenCalled()
  })
})
