import kacheLogo from '../assets/kache-logo.png'
import type { InvoiceClientInput, InvoicePayer, Letter } from './types'
import { boxGridSpan, vanLanes } from './van'

const invoiceRed = [248, 66, 69] as const
const money = (value: number) => `${value.toFixed(2).replace('.', ',')} €`
const shortDate = (value: string) => {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : new Date().toLocaleDateString('es-ES')
}

async function imageAsDataUrl(source: string) {
  const response = await fetch(source)
  const blob = await response.blob()
  const image = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = image.width; canvas.height = image.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se ha podido preparar el logotipo para la factura.')
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0)
  image.close()
  return canvas.toDataURL('image/png')
}

async function createInvoiceDocument(letter: Letter, payer: InvoicePayer, total: number, manualClient?: InvoiceClientInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const base = total / 1.21
  const tax = total - base
  const customer = payer === 'manual' ? manualClient?.fullName : payer === 'remitente' ? letter.sender : letter.recipient
  const phone = payer === 'manual' ? manualClient?.phone : payer === 'remitente' ? letter.senderPhone : letter.recipientPhone
  const clientLines = (payer === 'manual'
    ? [customer, manualClient?.nif && `NIF/CIF: ${manualClient.nif}`, manualClient?.address, [manualClient?.postalCode, manualClient?.city].filter(Boolean).join(' '), manualClient?.email, phone && `Tel.: ${phone}`].filter(Boolean) as string[]
    : [customer, phone ? `Tel.: ${phone}` : 'Datos fiscales pendientes', `Origen: ${letter.origin}`, `Destino: ${letter.destination}`]).filter((line): line is string => Boolean(line))
  const number = letter.id.match(/(\d{4})[-/](\d+)/)?.slice(1).join('/') ?? `${new Date().getFullYear()}/${letter.id.slice(-3)}`
  const date = shortDate(letter.serviceDate)
  const logo = await imageAsDataUrl(kacheLogo)
  const left = 18; const right = 192

  doc.setFont('helvetica', 'normal'); doc.setTextColor(18, 18, 18)
  doc.setFontSize(21); doc.text('Factura', left, 16)
  doc.addImage(logo, 'PNG', 143, 18, 49, 29)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('EMISOR', left, 24)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text(['Kache Envíos', 'NIF: 80156982G', 'Ctra. Pedroche s/n km 1,5', '14400 Pozoblanco', 'Córdoba (España)', 'transportedemascotas@kacheenvios.com', 'https://kacheenvios.com'], left, 29, { lineHeightFactor: 1.36 })

  doc.setFont('helvetica', 'bold'); doc.setTextColor(...invoiceRed); doc.setFontSize(8)
  doc.text('CLIENTE', left, 62); doc.text('NÚMERO', 166, 62, { align: 'center' })
  doc.setDrawColor(225, 227, 230); doc.setLineWidth(.35); doc.line(left, 66, 77, 66); doc.line(124, 66, right, 66)
  doc.setTextColor(18, 18, 18); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(clientLines, left, 73, { lineHeightFactor: 1.38 })
  doc.text(number, 166, 72, { align: 'center' })
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...invoiceRed); doc.setFontSize(8); doc.text('FECHA', 166, 81, { align: 'center' })
  doc.setDrawColor(225, 227, 230); doc.line(124, 84, right, 84)
  doc.setTextColor(18, 18, 18); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(date, 166, 90, { align: 'center' })

  doc.setFillColor(...invoiceRed); doc.rect(left, 100, 174, 7, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text('CONCEPTO', 19, 104.7); doc.text('CANT.', 137, 104.7, { align: 'center' }); doc.text('PRECIO', 156, 104.7, { align: 'center' }); doc.text('IVA', 171, 104.7, { align: 'center' }); doc.text('BASE', 187, 104.7, { align: 'center' })
  doc.setTextColor(18, 18, 18); doc.setFontSize(8); doc.text('Servicio de transporte de mascota', 19, 112)
  doc.setFont('helvetica', 'normal'); doc.text('1', 137, 112, { align: 'center' }); doc.text(money(base), 156, 112, { align: 'center' }); doc.text('21 %', 171, 112, { align: 'center' }); doc.text(money(base), 192, 112, { align: 'right' })
  doc.setDrawColor(239, 240, 241); doc.setLineWidth(.25); doc.line(left, 116, right, 116)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('BASE IMPONIBLE', 143, 126); doc.text(money(base), right, 126, { align: 'right' }); doc.text('IVA general (21 %)', 143, 132); doc.text(money(tax), right, 132, { align: 'right' })
  doc.setFontSize(13); doc.text('Total', 143, 142); doc.setFontSize(15); doc.text(money(total), right, 142, { align: 'right' })

  doc.setFontSize(9); doc.text('COBROS / VENCIMIENTOS', left, 160)
  doc.setFontSize(8); doc.text('FECHA', 19, 169); doc.text('IMPORTE', 50, 169); doc.text('MÉTODO DE PAGO', 91, 169); doc.text('CUENTA DESTINO', 143, 169)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(date, 19, 177); doc.text(money(total), 50, 177); doc.text('Transferencia', 91, 177); doc.text('ES19 2100 2093 9702 0016 6247', 143, 177)
  doc.setDrawColor(230, 231, 232); doc.line(left, 180, right, 180)
  const cancellationNote = 'EN CASO DE ANULACIÓN DEL TRANSPORTE, NO SE PROCEDERÁ A LA DEVOLUCIÓN DE '
  doc.setFontSize(8); doc.text(cancellationNote, left, 195); doc.setFont('helvetica', 'bold'); doc.text('LA RESERVA', left + doc.getTextWidth(cancellationNote), 195)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(83, 93, 109); doc.setFontSize(7); doc.text('1 / 1', right, 289, { align: 'right' })
  return { doc, fileName: `factura-${number.replace('/', '-')}.pdf` }
}

export async function downloadInvoice(letter: Letter, payer: InvoicePayer, total: number, manualClient?: InvoiceClientInput) {
  const { doc, fileName } = await createInvoiceDocument(letter, payer, total, manualClient)
  doc.save(fileName)
}

export async function previewInvoice(letter: Letter, payer: InvoicePayer, total: number, manualClient?: InvoiceClientInput) {
  const { doc, fileName } = await createInvoiceDocument(letter, payer, total, manualClient)
  return { url: doc.output('bloburl'), fileName }
}

export async function downloadVanManifest(assignments: Array<{ box: number; label: string; animalCount: number }>, routeName: string) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(30); doc.text('F U R G Ó N', 148, 17, { align: 'center' })
  doc.setDrawColor(80, 80, 80); doc.setLineWidth(.8); doc.rect(7, 23, 283, 12)
  doc.setFontSize(9); doc.text('P A R T E   D E L A N T E R A   ( C O N D U C T O R E S )', 148, 30.5, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(`Ruta ${routeName}`, 12, 20)
  const laneWidth = 31.5; const aisleWidth = 31.5; const startX = 7; const bodyY = 35; const bodyHeight = 165; const unit = bodyHeight / 24
  const lanes = [...vanLanes.filter((lane) => lane.side === 'left'), ...vanLanes.filter((lane) => lane.side === 'right')]
  const xForLane = (index: number) => index < 4 ? startX + index * laneWidth : startX + 4 * laneWidth + aisleWidth + (index - 4) * laneWidth
  lanes.forEach((lane, laneIndex) => {
    let row = 0
    lane.boxes.forEach((box) => {
      const span = boxGridSpan[lane.size]; const x = xForLane(laneIndex); const y = bodyY + row * unit; const h = span * unit
      const fill = lane.size === 'grande' ? [183, 183, 183] : lane.size === 'mediano' ? [255, 198, 185] : [222, 246, 226]
      doc.setFillColor(fill[0], fill[1], fill[2]); doc.setDrawColor(80, 80, 80); doc.setLineWidth(.25); doc.rect(x, y, laneWidth, h, 'FD')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(20, 20, 20); doc.text(String(box), x + laneWidth - 3, y + 5, { align: 'right' })
      const assignment = assignments.find((entry) => entry.box === box)
      if (assignment) { doc.setFont('helvetica', 'normal'); doc.setFontSize(4.5); doc.text(`${assignment.label.replace('CARTA DE PORTE Nº ', '#')} · ${assignment.animalCount} ${assignment.animalCount === 1 ? 'animal' : 'animales'}`, x + laneWidth / 2, y + h / 2, { align: 'center', maxWidth: laneWidth - 5 }) }
      row += span
    })
  })
  const aisleX = startX + 4 * laneWidth
  doc.setDrawColor(80, 80, 80); doc.setLineWidth(.25); doc.rect(aisleX, bodyY, aisleWidth, bodyHeight)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('P A S I L L O', aisleX + aisleWidth / 2, bodyY + bodyHeight / 2, { align: 'center' })
  doc.save(`furgon-${routeName.toLowerCase().replaceAll(' ', '-')}.pdf`)
}
