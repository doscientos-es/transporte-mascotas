import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { persistIssuedInvoiceDocument } from './invoice-document.ts'

const { page, logo, pdf, rest } = vi.hoisted(() => {
  const page = {
    drawText: vi.fn(),
    drawImage: vi.fn(),
    drawEllipse: vi.fn(),
    drawRectangle: vi.fn(),
    drawLine: vi.fn(),
  }
  const logo = { scaleToFit: vi.fn(() => ({ width: 92, height: 74 })) }
  const pdf = {
    addPage: vi.fn(() => page),
    embedFont: vi.fn(async () => ({ widthOfTextAtSize: () => 50 })),
    embedPng: vi.fn(async () => logo),
    save: vi.fn(async () => new Uint8Array([1])),
  }
  return { page, logo, pdf, rest: vi.fn() }
})

vi.mock('npm:pdf-lib@1.17.1', () => ({
  PDFDocument: { create: async () => pdf },
  StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'HelveticaBold' },
  rgb: (red: number, green: number, blue: number) => ({ red, green, blue }),
}))

vi.mock('./supabase.ts', () => ({ rest, serviceHeaders: () => ({}) }))

const invoice = {
  id: 'issued-invoice',
  invoice_draft_id: 'draft',
  issued_at: '2026-11-03T12:00:00Z',
  fiscal_snapshot: {
    number: '2026/001',
    issuer: { name: 'Kache Envíos', taxId: 'B12345678', address: 'Calle Emisor 1' },
    client: {
      fullName: 'Cliente de prueba',
      nif: '12345678Z',
      address: 'Calle Cliente 2',
      postalCode: '08001',
      city: 'Barcelona',
    },
    concept: 'Transporte de mascota',
    net_amount: 100,
    vat_rate: 21,
    vat_amount: 21,
    total_amount: 121,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('Deno', {
    env: { get: (key: string) => (key === 'SUPABASE_URL' ? 'https://storage.example' : undefined) },
  })
  rest
    .mockResolvedValueOnce(Response.json([invoice]))
    .mockResolvedValueOnce(Response.json([]))
    .mockResolvedValueOnce(new Response(null, { status: 201 }))
    .mockResolvedValueOnce(
      Response.json([{ invoice_draft_id: 'draft', issued_invoice_id: invoice.id }]),
    )
})

afterEach(() => vi.unstubAllGlobals())

describe('invoice branding', () => {
  it('draws the white logo centered without a circle and preserves its aspect ratio', async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([1])))
    vi.stubGlobal('fetch', fetch)

    await persistIssuedInvoiceDocument('draft')

    expect(fetch).toHaveBeenCalledWith(
      'https://www.kacheenvios.com/logo-white.png',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(logo.scaleToFit).toHaveBeenCalledWith(92, 74)
    expect(page.drawImage).toHaveBeenCalledWith(logo, { x: 66, y: 745, width: 92, height: 74 })
    expect(page.drawEllipse).not.toHaveBeenCalled()
  })

  it('still generates the invoice with a white fallback and no circle if the logo is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/logo-white.png')
          ? new Response(null, { status: 404 })
          : new Response(null, { status: 201 }),
      ),
    )

    await persistIssuedInvoiceDocument('draft')

    expect(page.drawImage).not.toHaveBeenCalled()
    expect(page.drawEllipse).not.toHaveBeenCalled()
    expect(page.drawText).toHaveBeenCalledWith(
      'K',
      expect.objectContaining({ color: { red: 1, green: 1, blue: 1 } }),
    )
  })
})
