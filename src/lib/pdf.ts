import type { IssuedInvoice } from './types'
import { boxGridSpan, vanLanes } from './van'

const invoiceRed = [248, 66, 69] as const
const money = (value: number) => `${value.toFixed(2).replace('.', ',')} €`
const shortDate = (value: string) => {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : new Date().toLocaleDateString('es-ES')
}
const filePart = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

async function imageAsDataUrl(source: string) {
  const response = await fetch(source)
  if (!response.ok) throw new Error('No se ha podido cargar el logotipo de la factura.')
  const blob = await response.blob()
  let image: ImageBitmap
  try {
    image = await createImageBitmap(blob)
  } catch {
    throw new Error('El navegador no ha podido preparar el logotipo de la factura.')
  }
  const canvas = document.createElement('canvas')
  canvas.width = image.width; canvas.height = image.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se ha podido preparar el logotipo para la factura.')
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0)
  image.close()
  return canvas.toDataURL('image/png')
}

async function createIssuedInvoiceDocument(invoice: IssuedInvoice) {
  const { jsPDF } = await import('jspdf')
  const snapshot = invoice.fiscalSnapshot
  const issuer = snapshot.issuer
  const client = snapshot.client
  if (!issuer?.name || !issuer.taxId || !issuer.address || !client?.fullName || !client.nif || !client.address || !client.postalCode || !client.city || !snapshot.concept || !Number.isFinite(snapshot.net_amount) || !Number.isFinite(snapshot.vat_amount) || !Number.isFinite(snapshot.total_amount)) throw new Error('La instantánea fiscal de esta factura está incompleta.')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  /* Previous invoice document implementations:
    const base = total / 1.21
    const tax = total - base
    const customer = payer === 'manual' ? manualClient?.fullName : payer === 'remitente' ? letter.sender : letter.recipient
    const phone = payer === 'manual' ? manualClient?.phone : payer === 'remitente' ? letter.senderPhone : letter.recipientPhone
    const clientLines = (payer === 'manual'
      ? [customer, manualClient?.nif && `NIF/CIF: ${manualClient.nif}`, manualClient?.address, [manualClient?.postalCode, manualClient?.city].filter(Boolean).join(' '), manualClient?.email, phone && `Tel.: ${phone}`].filter(Boolean) as string[]
      : [customer, phone ? `Tel.: ${phone}` : 'Datos fiscales pendientes', `Origen: ${letter.origin}`, `Destino: ${letter.destination}`]).filter((line): line is string => Boolean(line))
    const number = letter.id.match(/(\d{4})[-/](\d+)/)?.slice(1).join('/') ?? `${new Date().getFullYear()}/${letter.id.slice(-3)}`
    const date = shortDate(letter.serviceDate)
    // A raster asset avoids SVG decoding failures in browsers when producing the PDF in memory.
    const logo = await imageAsDataUrl('/icon-512.png')
   * Parent version:
    const base = total / 1.21
    const tax = total - base
    const customer = payer === 'manual' ? manualClient?.fullName : payer === 'remitente' ? letter.sender : letter.recipient
    const phone = payer === 'manual' ? manualClient?.phone : payer === 'remitente' ? letter.senderPhone : letter.recipientPhone
    const clientLines = (payer === 'manual'
      ? [customer, manualClient?.nif && `NIF/CIF: ${manualClient.nif}`, manualClient?.address, [manualClient?.postalCode, manualClient?.city].filter(Boolean).join(' '), manualClient?.email, phone && `Tel.: ${phone}`].filter(Boolean) as string[]
      : [customer, phone ? `Tel.: ${phone}` : 'Datos fiscales pendientes', `Origen: ${letter.origin}`, `Destino: ${letter.destination}`]).filter((line): line is string => Boolean(line))
    const number = letter.id.match(/(\d{4})[-/](\d+)/)?.slice(1).join('/') ?? `${new Date().getFullYear()}/${letter.id.slice(-3)}`
    const date = shortDate(letter.serviceDate)
    const logo = await imageAsDataUrl('/logo-light.svg')
   */
  const clientLines = [client.fullName, `NIF/CIF: ${client.nif}`, client.address, `${client.postalCode} ${client.city}`, client.email, client.phone && `Tel.: ${client.phone}`].filter(Boolean) as string[]
  const number = invoice.number
  const issuedDate = new Date(invoice.issuedAt).toLocaleDateString('es-ES')
  const operationDate = snapshot.operation_date ? shortDate(snapshot.operation_date) : issuedDate
  const base = Number(snapshot.net_amount)
  const tax = Number(snapshot.vat_amount)
  const total = Number(snapshot.total_amount)
  const logo = await imageAsDataUrl('/logo-light.svg')
  const left = 18; const right = 192

  doc.setFont('helvetica', 'normal'); doc.setTextColor(18, 18, 18)
  doc.setFontSize(21); doc.text('Factura', left, 16)
  doc.addImage(logo, 'PNG', 164, 18, 28, 28)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('EMISOR', left, 24)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text([issuer.name, `NIF/CIF: ${issuer.taxId}`, issuer.address], left, 29, { lineHeightFactor: 1.36 })

  doc.setFont('helvetica', 'bold'); doc.setTextColor(...invoiceRed); doc.setFontSize(8)
  doc.text('CLIENTE', left, 62); doc.text('NÚMERO', 166, 62, { align: 'center' })
  doc.setDrawColor(225, 227, 230); doc.setLineWidth(.35); doc.line(left, 66, 77, 66); doc.line(124, 66, right, 66)
  doc.setTextColor(18, 18, 18); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(clientLines, left, 73, { lineHeightFactor: 1.38 })
  doc.text(number, 166, 72, { align: 'center' })
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...invoiceRed); doc.setFontSize(8); doc.text('FECHA', 166, 81, { align: 'center' })
  doc.setDrawColor(225, 227, 230); doc.line(124, 84, right, 84)
  doc.setTextColor(18, 18, 18); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(issuedDate, 166, 90, { align: 'center' })

  doc.setFillColor(...invoiceRed); doc.rect(left, 100, 174, 7, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text('CONCEPTO', 19, 104.7); doc.text('CANT.', 137, 104.7, { align: 'center' }); doc.text('PRECIO', 156, 104.7, { align: 'center' }); doc.text('IVA', 171, 104.7, { align: 'center' }); doc.text('BASE', 187, 104.7, { align: 'center' })
  doc.setTextColor(18, 18, 18); doc.setFontSize(8); doc.text(snapshot.concept, 19, 112, { maxWidth: 112 })
  doc.setFont('helvetica', 'normal'); doc.text('1', 137, 112, { align: 'center' }); doc.text(money(base), 156, 112, { align: 'center' }); doc.text(`${snapshot.vat_rate ?? 0} %`, 171, 112, { align: 'center' }); doc.text(money(base), 192, 112, { align: 'right' })
  doc.setDrawColor(239, 240, 241); doc.setLineWidth(.25); doc.line(left, 116, right, 116)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('BASE IMPONIBLE', 143, 126); doc.text(money(base), right, 126, { align: 'right' }); doc.text('IVA general (21 %)', 143, 132); doc.text(money(tax), right, 132, { align: 'right' })
  doc.setFontSize(13); doc.text('Total', 143, 142); doc.setFontSize(15); doc.text(money(total), right, 142, { align: 'right' })

  doc.setFontSize(9); doc.text('OPERACIÓN Y COBRO', left, 160)
  doc.setFontSize(8); doc.text('FECHA OPERACIÓN', 19, 169); doc.text('IMPORTE', 63, 169); doc.text('MÉTODO DE PAGO', 102, 169)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(operationDate, 19, 177); doc.text(money(total), 63, 177); doc.text(snapshot.payment_method ?? 'Pago confirmado', 102, 177)
  doc.setDrawColor(230, 231, 232); doc.line(left, 180, right, 180)
  doc.setFontSize(7); doc.text('Factura emitida desde una instantánea fiscal inmutable.', left, 195)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(83, 93, 109); doc.setFontSize(7); doc.text('1 / 1', right, 289, { align: 'right' })
  return { doc, fileName: `factura_${filePart(client.fullName)}_${filePart(snapshot.operation_date ?? invoice.issuedAt)}.pdf` }
}

export async function downloadIssuedInvoice(invoice: IssuedInvoice) {
  const { doc, fileName } = await createIssuedInvoiceDocument(invoice)
  doc.save(fileName)
}

export async function previewIssuedInvoice(invoice: IssuedInvoice) {
  const { doc, fileName } = await createIssuedInvoiceDocument(invoice)
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
