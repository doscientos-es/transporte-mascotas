/// <reference types="node" />

import { readFile } from 'node:fs/promises'

import { describe, expect, it, vi } from 'vitest'

import type { Letter } from '@/shared/types'

import {
  createCarriageLetterPdf,
  createCarriageLettersPdf,
  letterToCarriageLetter,
} from './carriage-letter-pdf'

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

describe('createCarriageLettersPdf', () => {
  it('renders one distinct letter per page using the existing format', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Logo unavailable')))
    try {
      const makeLetter = (id: string, sender: string, box: number) =>
        letterToCarriageLetter(
          {
            id,
            sender,
            recipient: 'Cliente',
            origin: 'Madrid',
            destination: 'Vigo',
            animals: [],
            accompanyingDocuments: [],
          } as unknown as Letter,
          box,
        )
      const blob = await createCarriageLettersPdf([
        makeLetter('CARTA DE PORTE Nº 100', 'Ana', 17),
        makeLetter('CARTA DE PORTE Nº 200', 'Luis', 23),
      ])
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const task = getDocument({ data: new Uint8Array(await blob.arrayBuffer()) })
      try {
        const pdf = await task.promise
        expect(pdf.numPages).toBe(2)
        const pageText = async (page: number) =>
          (await (await pdf.getPage(page)).getTextContent()).items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ')
        const first = await pageText(1)
        const second = await pageText(2)
        expect(first).toContain('Nº 100')
        expect(first).toContain('Nº Box: 17')
        expect(first).toContain('Ana')
        expect(first).not.toContain('Luis')
        expect(second).toContain('Nº 200')
        expect(second).toContain('Nº Box: 23')
        expect(second).toContain('Luis')
        expect(second).not.toContain('Ana')
      } finally {
        await task.destroy()
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rejects an empty collection instead of creating a blank page', async () => {
    await expect(createCarriageLettersPdf([])).rejects.toThrow('No hay cartas de porte')
  })
})
