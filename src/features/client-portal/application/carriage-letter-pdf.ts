import type { Letter } from '@/shared/types'

import { formatDate } from './route-maps'
import type { TransportCarriageLetter } from './transport-requests'

const accompanyingDocumentLabels: Record<string, string> = {
  cartilla_sanitaria: 'Cartilla sanitaria',
  microchip: 'Microchip',
  pasaporte: 'Pasaporte',
  tatuaje: 'Tatuaje',
  anillo: 'Anillo',
  cites: 'CITES',
  otro: 'Otro documento',
}

export function letterToCarriageLetter(letter: Letter): TransportCarriageLetter {
  return {
    id: letter.id,
    service_date: letter.serviceDate,
    sender_name: letter.sender,
    sender_nif: letter.senderNif,
    sender_phone: letter.senderPhone,
    sender_email: letter.senderEmail,
    sender_address: letter.senderAddress,
    sender_postal_code: letter.senderPostalCode,
    sender_city: letter.senderCity,
    sender_province: letter.senderProvince,
    recipient_name: letter.recipient,
    recipient_nif: letter.recipientNif,
    recipient_phone: letter.recipientPhone,
    recipient_email: letter.recipientEmail,
    recipient_address: letter.recipientAddress,
    recipient_postal_code: letter.recipientPostalCode,
    recipient_city: letter.recipientCity,
    recipient_province: letter.recipientProvince,
    origin_text: letter.origin,
    destination_text: letter.destination,
    origin_point: letter.originPoint,
    destination_point: letter.destinationPoint,
    accompanying_documents: letter.accompanyingDocuments,
    animals: letter.animals.map((animal, index) => ({
      ordinal: index + 1,
      species: animal.species,
      breed: animal.breed,
      identification: '',
      weight_kg: animal.weightKg || null,
      length_cm: animal.lengthCm || null,
      height_cm: animal.heightCm || null,
      width_cm: animal.widthCm || null,
    })),
  }
}

type Party = {
  name: string
  nif: string
  phone: string
  email: string
  address: string
  postalCode: string
  city: string
  province: string
}

const party = (letter: TransportCarriageLetter, role: 'sender' | 'recipient'): Party => ({
  name: letter[`${role}_name`],
  nif: letter[`${role}_nif`],
  phone: letter[`${role}_phone`],
  email: letter[`${role}_email`],
  address: letter[`${role}_address`],
  postalCode: letter[`${role}_postal_code`],
  city: letter[`${role}_city`],
  province: letter[`${role}_province`],
})

export function carriageLetterFileName(letter: TransportCarriageLetter) {
  const slug = letter.id
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `${slug || 'carta-de-porte'}.pdf`
}

export async function createCarriageLetterPdf(letter: TransportCarriageLetter) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const left = 15
  const width = 180
  let y = 18

  doc.setFillColor(28, 28, 26)
  doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('KACHE ENVÍOS', left, y)
  doc.setFontSize(11)
  doc.text(letter.id, 195, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Carta de porte · Transporte de animales de compañía', left, y + 6)
  doc.setTextColor(28, 28, 26)
  y = 42

  const section = (title: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(245, 66, 69)
    doc.text(title.toUpperCase(), left, y)
    doc.setTextColor(28, 28, 26)
    doc.setDrawColor(220, 215, 210)
    doc.line(left, y + 1.5, left + width, y + 1.5)
    y += 7
  }
  const row = (label: string, value: string, x = left, columnWidth = width) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(107, 102, 97)
    doc.text(label, x, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(28, 28, 26)
    const lines = doc.splitTextToSize(value.trim() || '—', columnWidth - 2) as string[]
    doc.text(lines, x, y + 4.5)
    return 4.5 + lines.length * 4.5
  }
  const partyBlock = (title: string, value: Party, x: number) => {
    const start = y
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(title, x, y)
    y += 6
    const address = [
      value.address,
      [value.postalCode, value.city].filter(Boolean).join(' '),
      value.province,
    ]
      .filter((part) => part.trim())
      .join(', ')
    for (const [label, text] of [
      ['Nombre', value.name],
      ['DNI/NIE', value.nif],
      ['Teléfono', value.phone],
      ['Email', value.email],
      ['Dirección', address],
    ] as const)
      y += row(label, text, x, 86) + 1.5
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
    partyBlock('Remitente', party(letter, 'sender'), left),
    partyBlock('Destinatario', party(letter, 'recipient'), 108),
  )
  y += 4

  section('Animales transportados')
  letter.animals.forEach((animal) => {
    const measures = [animal.length_cm, animal.width_cm, animal.height_cm]
    const details = [
      `${animal.ordinal}. ${animal.species}${animal.breed ? ` · ${animal.breed}` : ''}`,
      animal.identification && `Identificación: ${animal.identification}`,
      animal.weight_kg ? `${animal.weight_kg} kg` : '',
      measures.every(Boolean) ? `${measures.join(' × ')} cm` : '',
      animal.shared_box ? `Box compartido ${animal.shared_box}` : '',
    ].filter(Boolean)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(details.join('   ·   '), width) as string[]
    doc.text(lines, left, y)
    y += lines.length * 5 + 1.5
  })
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

  doc.setFontSize(8)
  doc.setTextColor(107, 102, 97)
  doc.text(`Documento generado el ${new Date().toLocaleString('es-ES')}`, left, 287)
  return doc.output('blob')
}
