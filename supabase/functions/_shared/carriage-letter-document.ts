import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

import { CARRIAGE_LETTER_PAGE, drawCarriageLetter, type RGB } from './carriage-letter-layout.ts'
import { rest } from './supabase.ts'

type Animal = {
  ordinal: number
  species: string
  breed: string
  identification: string
  birth_date: string | null
  weight_kg: number | null
  length_cm: number | null
  height_cm: number | null
  width_cm: number | null
  /** Pets with the same number travel in one box. */
  shared_box?: number | null
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
  transport_box_number: number | null
  animals: Animal[]
}

export async function loadCarriageLetter(letterId: string): Promise<CarriageLetter | null> {
  const fields = [
    'id',
    'service_date',
    'sender_name',
    'sender_nif',
    'sender_phone',
    'sender_email',
    'sender_address',
    'sender_postal_code',
    'sender_city',
    'sender_province',
    'recipient_name',
    'recipient_nif',
    'recipient_phone',
    'recipient_email',
    'recipient_address',
    'recipient_postal_code',
    'recipient_city',
    'recipient_province',
    'origin_text',
    'destination_text',
    'origin_point',
    'destination_point',
    'accompanying_documents',
    'animals(ordinal,species,breed,identification,birth_date,weight_kg,length_cm,height_cm,width_cm)',
  ].join(',')
  const response = await rest(
    `carriage_letters?id=eq.${encodeURIComponent(letterId)}&select=${fields}`,
  )
  const [letter] = (await response.json()) as Array<Omit<CarriageLetter, 'transport_box_number'>>
  if (!letter) return null

  const requestResponse = await rest(
    `transport_requests?letter_id=eq.${encodeURIComponent(letterId)}&select=daily_route_id,transport_request_animals(ordinal,shared_box_group)`,
  )
  const [request] = (await requestResponse.json()) as Array<{
    daily_route_id: string | null
    transport_request_animals: Array<{ ordinal: number; shared_box_group: string | null }>
  }>
  const assignmentResponse = request?.daily_route_id
    ? await rest(
        `van_assignments?daily_route_id=eq.${encodeURIComponent(request.daily_route_id)}&letter_id=eq.${encodeURIComponent(letterId)}&select=box_number&order=created_at.desc&limit=1`,
      )
    : null
  const [assignment] = assignmentResponse
    ? ((await assignmentResponse.json()) as Array<{ box_number: number }>)
    : []
  const groups = [
    ...new Set(
      (request?.transport_request_animals ?? [])
        .map((animal) => animal.shared_box_group)
        .filter((group): group is string => Boolean(group))
        .toSorted(),
    ),
  ]
  const sharedBox = (ordinal: number) => {
    const group = request?.transport_request_animals.find(
      (animal) => animal.ordinal === ordinal,
    )?.shared_box_group
    return group ? groups.indexOf(group) + 1 : null
  }
  return {
    ...letter,
    transport_box_number: assignment?.box_number ?? null,
    animals: letter.animals
      .map((animal) => ({ ...animal, shared_box: sharedBox(animal.ordinal) }))
      .toSorted((a, b) => a.ordinal - b.ordinal),
  }
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

/** Standard PDF fonts only encode WinAnsi, so anything outside it is replaced. */
const printable = (value: string) =>
  value.replaceAll('→', '->').replace(/[^\u0020-\u007e\u00a0-\u00ff€–—‘’“”•…]/g, '')

const mm = (value: number) => value * 2.834645669
const channel = (value: RGB) => rgb(value[0] / 255, value[1] / 255, value[2] / 255)

/** Server-side render of the half-sheet carriage letter, same layout as the client portal PDF. */
export async function renderCarriageLetter(letter: CarriageLetter) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(printable(letter.id))
  pdf.setAuthor('Kache Envíos')
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = CARRIAGE_LETTER_PAGE
  const page = pdf.addPage([mm(width), mm(height)])
  const logoBytes = await fetch('https://www.kacheenvios.com/icon-512.png', {
    signal: AbortSignal.timeout(3000),
  })
    .then(async (response) =>
      response.ok ? new Uint8Array(await response.arrayBuffer()) : undefined,
    )
    .catch(() => undefined)
  const logo = logoBytes ? await pdf.embedPng(logoBytes).catch(() => undefined) : undefined
  const pick = (isBold?: boolean) => (isBold ? bold : regular)

  drawCarriageLetter(
    {
      rect(x, y, w, h, { fill, stroke, lineWidth }) {
        page.drawRectangle({
          x: mm(x),
          y: mm(height - y - h),
          width: mm(w),
          height: mm(h),
          color: fill ? channel(fill) : undefined,
          borderColor: stroke ? channel(stroke) : undefined,
          borderWidth: stroke ? mm(lineWidth ?? 0.3) : 0,
        })
      },
      text(value, x, y, { size, bold: isBold, color = [0, 0, 0], align = 'left' }) {
        const font = pick(isBold)
        const text = printable(value)
        const textWidth = font.widthOfTextAtSize(text, size)
        const offset = align === 'center' ? textWidth / 2 : align === 'right' ? textWidth : 0
        page.drawText(text, {
          x: mm(x) - offset,
          y: mm(height - y),
          size,
          font,
          color: channel(color),
        })
      },
      image(_data, x, y, w, h) {
        if (!logo) return
        page.drawImage(logo, {
          x: mm(x),
          y: mm(height - y - h),
          width: mm(w),
          height: mm(h),
        })
      },
      width: (value, size, isBold) =>
        pick(isBold).widthOfTextAtSize(printable(value), size) / mm(1),
    },
    letter,
    logoBytes,
  )
  return { body: await pdf.save(), fileName: carriageLetterFileName(letter) }
}
