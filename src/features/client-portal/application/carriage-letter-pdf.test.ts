/// <reference types="node" />

import { readFile } from 'node:fs/promises'

import { describe, expect, it, vi } from 'vitest'

import type { Letter } from '@/shared/types'

import { createCarriageLetterPdf, letterToCarriageLetter } from './carriage-letter-pdf'

describe('letterToCarriageLetter', () => {
  it('includes each animal birth date and the assigned transport box number', () => {
    const letter = {
      id: 'CARTA DE PORTE Nº 2026-P00001',
      animals: [
        {
          id: 'animal-1',
          species: 'Perro',
          breed: 'Mestizo',
          identification: '123456789',
          birthDate: '2020-06-12',
          weightKg: 12,
          lengthCm: 40,
          heightCm: 30,
          widthCm: 20,
        },
      ],
    } as unknown as Letter

    const document = letterToCarriageLetter(letter, 17)

    expect(document.transport_box_number).toBe(17)
    expect(document.animals[0]?.birth_date).toBe('2020-06-12')
    expect(document.animals[0]?.identification).toBe('123456789')
  })
})

describe('createCarriageLetterPdf', () => {
  it('generates the printable letter with the current logo and assigned box', async () => {
    const logo = await readFile('public/logo.png')
    const fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => Uint8Array.from(logo).buffer,
    }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const letter = {
        id: 'CARTA DE PORTE Nº 2026-480',
        sender: 'Ana',
        recipient: 'Luis',
        origin: 'Madrid',
        destination: 'Vigo',
        accompanyingDocuments: ['microchip'],
        animals: [{ species: 'Perro', breed: 'Mestizo' }],
      } as unknown as Letter
      const blob = await createCarriageLetterPdf(letterToCarriageLetter(letter, 17))
      const bytes = await blob.arrayBuffer()
      const pdfSource = new TextDecoder('latin1').decode(bytes)
      const imageTransform = /([0-9.]+) 0 0 ([0-9.]+) ([0-9.]+) ([0-9.]+) cm\s*\/I[0-9]+ Do/.exec(
        pdfSource,
      )
      expect(imageTransform).not.toBeNull()
      expect(Number(imageTransform?.[1]) / Number(imageTransform?.[2])).toBeCloseTo(1399 / 1124)
      const pointsPerMm = 72 / 25.4
      expect(Number(imageTransform?.[1]) / pointsPerMm).toBeCloseTo(32)
      expect(
        (Number(imageTransform?.[3]) + Number(imageTransform?.[1]) / 2) / pointsPerMm,
      ).toBeCloseTo(105)
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const task = getDocument({ data: new Uint8Array(bytes) })
      try {
        const page = await (await task.promise).getPage(1)
        const content = await page.getTextContent()
        const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
        expect(fetchMock).toHaveBeenCalledWith('/logo.png')
        expect(text).toContain('2026-480')
        expect(text).toContain('Nº Box: 17')
        expect(text).toContain('Ana')
        expect(text).toContain('Luis')
        expect(text).toContain('Mestizo')
      } finally {
        await task.destroy()
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
