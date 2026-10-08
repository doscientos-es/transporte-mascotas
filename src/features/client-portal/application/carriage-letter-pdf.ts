import type { Letter } from '@/shared/types'

import { CARRIAGE_LETTER_PAGE, drawCarriageLetter } from './carriage-letter-layout'
import type { TransportCarriageLetter } from './transport-requests'

export function letterToCarriageLetter(
  letter: Letter,
  transportBoxNumber: number | null = null,
): TransportCarriageLetter {
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
    transport_box_number: transportBoxNumber,
    animals: letter.animals.map((animal, index) => ({
      ordinal: index + 1,
      species: animal.species,
      breed: animal.breed,
      identification: animal.identification ?? '',
      birth_date: animal.birthDate || null,
      weight_kg: animal.weightKg || null,
      length_cm: animal.lengthCm || null,
      height_cm: animal.heightCm || null,
      width_cm: animal.widthCm || null,
    })),
  }
}

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
  const { width, height } = CARRIAGE_LETTER_PAGE
  const doc = new jsPDF({ unit: 'mm', format: [width, height], orientation: 'landscape' })
  const logo = await fetch('/icon-512.png')
    .then(async (response) => (response.ok ? new Uint8Array(await response.arrayBuffer()) : null))
    .catch(() => null)
  const font = (size: number, bold?: boolean) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
  }
  drawCarriageLetter(
    {
      rect(x, y, w, h, { fill, stroke, lineWidth }) {
        if (fill) doc.setFillColor(...fill)
        if (stroke) {
          doc.setDrawColor(...stroke)
          doc.setLineWidth(lineWidth ?? 0.3)
        }
        doc.rect(x, y, w, h, fill && stroke ? 'FD' : fill ? 'F' : 'S')
      },
      text(value, x, y, { size, bold, color = [0, 0, 0], align = 'left' }) {
        font(size, bold)
        doc.setTextColor(...color)
        doc.text(value, x, y, { align })
      },
      image(data, x, y, w, h) {
        doc.addImage(data, 'PNG', x, y, w, h)
      },
      width(value, size, bold) {
        font(size, bold)
        return doc.getTextWidth(value)
      },
    },
    letter,
    logo ?? undefined,
  )
  return doc.output('blob')
}
