// Keep identical to supabase/functions/_shared/carriage-letter-layout.ts (Deno cannot import from src).
// Half-sheet (A5 landscape, 210 x 148 mm) carriage letter layout, independent of the PDF library.
export type RGB = [number, number, number]
export type TextOptions = {
  size: number
  bold?: boolean
  color?: RGB
  align?: 'left' | 'center' | 'right'
}
/** Drawing surface; `y` of text is the baseline, measured from the top edge in mm. */
export interface PdfCanvas {
  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    style: { fill?: RGB; stroke?: RGB; lineWidth?: number },
  ): void
  text(value: string, x: number, y: number, options: TextOptions): void
  width(value: string, size: number, bold?: boolean): number
  image?(data: Uint8Array, x: number, y: number, w: number, h: number): void
}
export type LayoutLetter = {
  id: string
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
  transport_box_number?: number | null
  animals: Array<{ species: string; breed: string; birth_date?: string | null }>
}

export const CARRIAGE_LETTER_PAGE = { width: 210, height: 148 }

const X0 = 4
const X1 = 206
const MID = 105
const TAB = 6
const BLACK: RGB = [0, 0, 0]
const FRAME: RGB = [70, 70, 70]
const SENDER: [RGB, RGB] = [
  [255, 238, 232],
  [244, 106, 70],
]
const RECIPIENT: [RGB, RGB] = [
  [238, 238, 238],
  [120, 120, 120],
]

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
const speciesKind = (species: string) => {
  const value = fold(species)
  if (/perr|canin|dog/.test(value)) return 0
  if (/gat|felin|cat/.test(value)) return 1
  if (/\bave|pajar|loro|bird/.test(value)) return 2
  return 3
}
const documentKeys = [
  ['cartilla_sanitaria', 'microchip', 'pasaporte', 'tatuaje'],
  ['anillo', 'cites', 'otro', ''],
]
const locality = (value: string) => {
  const parts = value.split(/\s*[-–—]\s*/)
  return (parts.length > 1 ? parts.slice(1).join(' - ') : value).trim()
}
const letterNumber = (id: string) =>
  id.replace(/^CARTA DE PORTE\s*N[º°]?\s*/i, '').trim() || 'No especificado'

export function drawCarriageLetter(canvas: PdfCanvas, letter: LayoutLetter, logo?: Uint8Array) {
  const fit = (value: string, size: number, width: number, bold = false) => {
    let text = value.replace(/\s+/g, ' ').trim()
    while (text.length > 1 && canvas.width(text, size, bold) > width) text = `${text.slice(0, -2)}…`
    return text
  }
  const gradient = (x: number, y: number, w: number, h: number, [from, to]: [RGB, RGB]) => {
    const steps = 14
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1)
      const fill = from.map((c, k) => Math.round(c + ((to[k] ?? c) - c) * t)) as RGB
      canvas.rect(x, y + (h / steps) * i, w, h / steps + 0.15, { fill })
    }
  }
  const cell = (x: number, y: number, w: number, h: number, colors?: [RGB, RGB]) => {
    if (colors) gradient(x, y, w, h, colors)
    canvas.rect(x, y, w, h, { stroke: FRAME, lineWidth: 0.4 })
  }
  const field = (x: number, y: number, w: number, h: number, label: string, value = '') => {
    canvas.text(label, x + 1.5, y + 3.8, { size: 7, bold: true, color: BLACK })
    if (value) canvas.text(fit(value, 8, w - 3), x + 1.5, y + h - 2, { size: 8, color: BLACK })
  }
  const plain = (x: number, y: number, w: number, h: number, label: string, align = 'left') => {
    const at = align === 'right' ? x + w - 1.5 : align === 'center' ? x + w / 2 : x + 1.5
    canvas.text(label, at, y + h / 2 + 1.1, {
      size: 7.5,
      bold: !label.startsWith('('),
      align: align as TextOptions['align'],
    })
  }
  const stacked = (word: string, x: number, y: number, h: number, size: number, color: RGB) =>
    word.split('').forEach((char, i) =>
      canvas.text(char, x, y + (h / word.length) * (i + 0.5) + size * 0.17, {
        size,
        color,
        align: 'center',
      }),
    )

  // Header
  canvas.rect(X0, 4, X1 - X0, 24, { fill: [255, 255, 255], stroke: BLACK, lineWidth: 0.9 })
  if (logo && canvas.image) canvas.image(logo, 8, 5, 22, 22)
  else canvas.text('KACHE ENVÍOS', 10, 18, { size: 8, bold: true })
  canvas.text('CARTA DE PORTE', 198, 10, { size: 7, bold: true, align: 'right' })
  canvas.text(`Nº ${letterNumber(letter.id)}`, 198, 16, { size: 7, align: 'right' })
  canvas.text(`Nº Box: ${letter.transport_box_number ?? 'No especificado'}`, 198, 23, {
    size: 8,
    bold: true,
    align: 'right',
  })

  // Sender / recipient
  const parties = [
    { role: 'sender', x: X0 + TAB, colors: SENDER },
    { role: 'recipient', x: MID, colors: RECIPIENT },
  ] as const
  for (const { role, x, colors } of parties) {
    const get = (key: string): string => {
      const value: unknown = letter[`${role}_${key}` as keyof LayoutLetter]
      return typeof value === 'string' ? value : ''
    }
    const w = MID - X0 - TAB
    const split = x + 53
    const rows: Array<Array<[string, string]>> = [
      [['Nombre:', get('name')]],
      [
        ['Domicilio:', get('address')],
        ['DNI:', get('nif')],
      ],
      [
        ['Población:', [get('city'), get('province')].filter(Boolean).join(', ')],
        ['Mail:', get('email')],
      ],
      [
        ['C.P.:', get('postal_code')],
        ['Telf:', get('phone')],
      ],
    ]
    rows.forEach((row, i) => {
      const y = 28 + 11 * i
      row.forEach(([label, value], j) => {
        const cx = row.length === 1 ? x : j === 0 ? x : split
        const cw = row.length === 1 ? w : j === 0 ? 53 : w - 53
        cell(cx, y, cw, 11, colors)
        field(cx, y, cw, 11, label, value)
      })
    })
  }
  canvas.rect(X0, 28, TAB, 44, { fill: [244, 106, 70], stroke: FRAME, lineWidth: 0.4 })
  stacked('REMITENTE', X0 + TAB / 2, 28, 44, 7, BLACK)
  canvas.rect(X1 - TAB, 28, TAB, 44, { fill: [120, 120, 120], stroke: FRAME, lineWidth: 0.4 })
  stacked('DESTINATARIO', X1 - TAB / 2, 28, 44, 6, [255, 255, 255])

  // Species and accompanying documents
  cell(X0, 72, MID - X0, 6.6)
  plain(X0, 72, MID - X0, 6.6, 'ESPECIE', 'center')
  cell(MID, 72, X1 - MID, 6.6)
  plain(MID, 72, X1 - MID, 6.6, 'DOCUMENTO QUE ACOMPAÑA', 'center')
  const kinds = new Set(letter.animals.map((animal) => speciesKind(animal.species)))
  const others = letter.animals.filter((a) => speciesKind(a.species) === 3).map((a) => a.species)
  const breeds = [...new Set(letter.animals.map((animal) => animal.breed).filter(Boolean))]
  const docs = new Set(letter.accompanying_documents ?? [])
  const mark = (x: number, y: number, w: number, h: number, on: boolean) => {
    cell(x, y, w, h)
    if (on) canvas.text('X', x + w / 2, y + h / 2 + 1.4, { size: 8, bold: true, align: 'center' })
  }
  const species: Array<[string, string, string]> = [
    ['Canina', 'Raza:', breeds.join(', ')],
    ['Felina', 'Nº animales:', String(letter.animals.length || '')],
    [
      'Ave',
      'Fecha nacimiento:',
      letter.animals
        .map(({ birth_date }) => {
          const date = birth_date?.trim()
          if (!date) return 'No especificado'
          const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
          return match ? `${match[3]}/${match[2]}/${match[1]}` : date
        })
        .join(', ') || 'No especificado',
    ],
    ['Otro', '(Especificar)', others.join(', ')],
  ]
  species.forEach(([name, label, value], i) => {
    const y = 78.6 + 9.4 * i
    mark(X0, y, TAB, 9.4, kinds.has(i))
    cell(X0 + TAB, y, 53, 9.4)
    plain(X0 + TAB, y, 53, 9.4, name)
    cell(63, y, MID - 63, 9.4)
    if (i === 3) canvas.text(fit(value || label, 7.5, MID - 66), 64.5, y + 5.5, { size: 7.5 })
    else field(63, y, MID - 63, 9.4, label, value)
    cell(MID, y, 47, 9.4)
    const leftKey = documentKeys[0]?.[i]
    const rightKey = documentKeys[1]?.[i]
    if (leftKey) {
      plain(MID, y, 47, 9.4, labelFor(leftKey), 'right')
      mark(152, y, TAB, 9.4, docs.has(leftKey))
    }
    if (i === 3) {
      cell(158, y, X1 - 158, 9.4)
      plain(158, y, X1 - 158, 9.4, '(Especificar)')
    } else {
      cell(158, y, 41, 9.4)
      if (rightKey) {
        plain(158, y, 41, 9.4, labelFor(rightKey), 'right')
        mark(199, y, X1 - 199, 9.4, docs.has(rightKey))
      }
    }
  })

  // Origin, destination and signatures
  const place = (x: number, label: string, text: string) => {
    cell(x, 116.2, 44, 6.5)
    plain(x, 116.2, 44, 6.5, label)
    cell(x + 44, 116.2, 57, 6.5)
    const value = locality(text)
    if (value) canvas.text(fit(value, 6.5, 54), x + 45.5, 120.6, { size: 6.5 })
  }
  place(X0, 'PUNTO DE ORIGEN', letter.origin_text)
  place(MID, 'PUNTO DE DESTINO', letter.destination_text)
  cell(X0, 122.7, MID - X0, 21.3, SENDER)
  canvas.text('FIRMA REMITENTE', X0 + 1.5, 126.8, { size: 7.5, bold: true })
  cell(MID, 122.7, X1 - MID, 21.3, RECIPIENT)
  canvas.text('FIRMA DESTINATARIO', MID + 1.5, 126.8, { size: 7.5, bold: true })
}

const labelFor = (key: string) =>
  ({
    cartilla_sanitaria: 'Cartilla sanitaria',
    microchip: 'Microchip',
    pasaporte: 'Pasaporte',
    tatuaje: 'Tatuaje',
    anillo: 'Anillo',
    cites: 'C.I.T.E.S.',
    otro: 'Otro',
  })[key] ?? ''
