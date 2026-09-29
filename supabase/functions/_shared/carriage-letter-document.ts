import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

import { rest } from './supabase.ts'

type Animal = {
  ordinal: number
  species: string
  breed: string
  identification: string
  weight_kg: number | null
  length_cm: number | null
  height_cm: number | null
  width_cm: number | null
}
export type CarriageLetter = {
  id: string
  service_date: string
  sender_name: string
  sender_nif: string
  sender_phone: string
  sender_email: string
  sender_address: string
  sender_postal_code: string
  sender_city: string
  sender_province: string
  recipient_name: string
  recipient_nif: string
  recipient_phone: string
  recipient_email: string
  recipient_address: string
  recipient_postal_code: string
  recipient_city: string
  recipient_province: string
  origin_text: string
  destination_text: string
  origin_point: string
  destination_point: string
  accompanying_documents: string[] | null
  animals: Animal[]
}

const accompanyingDocumentLabels: Record<string, string> = {
  cartilla_sanitaria: 'Cartilla sanitaria',
  microchip: 'Microchip',
  pasaporte: 'Pasaporte',
  tatuaje: 'Tatuaje',
  anillo: 'Anillo',
  cites: 'CITES',
  otro: 'Otro documento',
}
const partyFields = ['name', 'nif', 'phone', 'email', 'address', 'postal_code', 'city', 'province']
const animalFields = 'ordinal,species,breed,identification,weight_kg,length_cm,height_cm,width_cm'

export async function loadCarriageLetter(letterId: string): Promise<CarriageLetter | null> {
  const select = [
    'id',
    'service_date',
    ...partyFields.flatMap((field) => [`sender_${field}`, `recipient_${field}`]),
    'origin_text,destination_text,origin_point,destination_point,accompanying_documents',
    `animals(${animalFields})`,
  ].join(',')
  const response = await rest(
    `carriage_letters?id=eq.${encodeURIComponent(letterId)}&select=${select}`,
  )
  const [letter] = (await response.json()) as CarriageLetter[]
  if (!letter) return null
  return { ...letter, animals: letter.animals.toSorted((a, b) => a.ordinal - b.ordinal) }
}

export function carriageLetterFileName(letter: Pick<CarriageLetter, 'id'>) {
  const slug = letter.id
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `${slug || 'carta-de-porte'}.pdf`
}

const formatDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

/** Standard PDF fonts only encode WinAnsi, so anything outside it is replaced. */
const printable = (value: string) =>
  value.replaceAll('→', '->').replace(/[^\u0020-\u007e\u00a0-\u00ff€–—‘’“”•…]/g, '')

const mm = (value: number) => value * 2.834645669
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const ink = rgb(28 / 255, 28 / 255, 26 / 255)
const coral = rgb(245 / 255, 66 / 255, 69 / 255)
const muted = rgb(107 / 255, 102 / 255, 97 / 255)
const rule = rgb(220 / 255, 215 / 255, 210 / 255)
const white = rgb(1, 1, 1)

function wrap(value: string, font: PDFFont, size: number, widthMm: number) {
  const lines: string[] = []
  for (const paragraph of printable(value).split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (line && font.widthOfTextAtSize(candidate, size) > mm(widthMm)) {
        lines.push(line)
        line = word
      } else line = candidate
    }
    lines.push(line)
  }
  return lines
}

/** Server-side port of the client portal carriage letter (carriage-letter-pdf.ts). */
export async function renderCarriageLetter(letter: CarriageLetter) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(printable(letter.id))
  pdf.setAuthor('Kache Envíos')
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let page: PDFPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const left = 15
  const width = 180
  let y = 18

  const text = (value: string, x: number, top: number, size: number, font = regular, color = ink) =>
    page.drawText(printable(value), { x: mm(x), y: PAGE_HEIGHT - mm(top), size, font, color })
  const textRight = (value: string, right: number, top: number, size: number, font = regular) =>
    text(
      value,
      right - font.widthOfTextAtSize(printable(value), size) / mm(1),
      top,
      size,
      font,
      white,
    )
  const ensureSpace = (heightMm: number) => {
    if (y + heightMm <= 280) return
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = 20
  }

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - mm(30),
    width: PAGE_WIDTH,
    height: mm(30),
    color: ink,
  })
  text('KACHE ENVÍOS', left, y, 18, bold, white)
  textRight(letter.id, 195, y, 11, bold)
  text('Carta de porte · Transporte de animales de compañía', left, y + 6, 9, regular, white)
  y = 42

  const section = (title: string) => {
    ensureSpace(16)
    text(title.toUpperCase(), left, y, 10, bold, coral)
    page.drawLine({
      start: { x: mm(left), y: PAGE_HEIGHT - mm(y + 1.5) },
      end: { x: mm(left + width), y: PAGE_HEIGHT - mm(y + 1.5) },
      thickness: 0.5,
      color: rule,
    })
    y += 7
  }
  const row = (label: string, value: string, x = left, columnWidth = width) => {
    text(label, x, y, 8, bold, muted)
    const lines = wrap(value.trim() || '—', regular, 10, columnWidth - 2)
    lines.forEach((line, index) => text(line, x, y + 4.5 + index * 4.5, 10))
    return 4.5 + lines.length * 4.5
  }
  const partyBlock = (title: string, role: 'sender' | 'recipient', x: number) => {
    const start = y
    const value = (field: string) =>
      String(letter[`${role}_${field}` as keyof CarriageLetter] ?? '')
    text(title, x, y, 10, bold)
    y += 6
    const address = [
      value('address'),
      [value('postal_code'), value('city')].filter(Boolean).join(' '),
      value('province'),
    ]
      .filter((part) => part.trim())
      .join(', ')
    for (const [label, content] of [
      ['Nombre', value('name')],
      ['DNI/NIE', value('nif')],
      ['Teléfono', value('phone')],
      ['Email', value('email')],
      ['Dirección', address],
    ] as const)
      y += row(label, content, x, 86) + 1.5
    const end = y
    y = start
    return end
  }

  section('Servicio')
  row('Fecha de servicio', formatDate(letter.service_date), left, 60)
  const pickupHeight = row(
    'Recogida',
    [letter.origin_text, letter.origin_point].filter(Boolean).join(' · '),
    75,
    60,
  )
  const deliveryHeight = row(
    'Entrega',
    [letter.destination_text, letter.destination_point].filter(Boolean).join(' · '),
    135,
    60,
  )
  y += Math.max(pickupHeight, deliveryHeight) + 4

  section('Intervinientes')
  y = Math.max(
    partyBlock('Remitente', 'sender', left),
    partyBlock('Destinatario', 'recipient', 108),
  )
  y += 4

  section('Animales transportados')
  for (const animal of letter.animals) {
    const measures = [animal.length_cm, animal.width_cm, animal.height_cm]
    const details = [
      `${animal.ordinal}. ${animal.species}${animal.breed ? ` · ${animal.breed}` : ''}`,
      animal.identification && `Identificación: ${animal.identification}`,
      animal.weight_kg ? `${animal.weight_kg} kg` : '',
      measures.every(Boolean) ? `${measures.join(' × ')} cm` : '',
    ].filter(Boolean)
    const lines = wrap(details.join('   ·   '), regular, 10, width)
    ensureSpace(lines.length * 5 + 1.5)
    lines.forEach((line, index) => text(line, left, y + index * 5, 10))
    y += lines.length * 5 + 1.5
  }
  if (letter.animals.length === 0) y += row('Animales', '')
  y += 4

  if (letter.accompanying_documents?.length) {
    section('Documentación que acompaña')
    y +=
      row(
        'Documentos',
        letter.accompanying_documents
          .map((document) => accompanyingDocumentLabels[document] ?? document)
          .join(', '),
      ) + 4
  }

  const generatedAt = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
  for (const current of pdf.getPages())
    current.drawText(`Documento generado el ${generatedAt}`, {
      x: mm(left),
      y: PAGE_HEIGHT - mm(287),
      size: 8,
      font: regular,
      color: muted,
    })
  return { body: await pdf.save(), fileName: carriageLetterFileName(letter) }
}
