import type { jsPDF } from 'jspdf'

export type PaymentRequestDocumentInput = {
  letterId: string
  letterName?: string
  clientName: string
  concept: string
  total: number
  createdAt: string
}

const currency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)

const date = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(value),
  )

const filePart = (value: string) => value.replaceAll(/[^a-zA-Z0-9_-]/g, '-').replaceAll(/-+/g, '-')

const colors = {
  ink: [29, 29, 27] as const,
  coral: [244, 67, 68] as const,
  cream: [250, 247, 244] as const,
  muted: [105, 101, 98] as const,
  line: [226, 220, 215] as const,
  white: [255, 255, 255] as const,
}

async function addBrandLogo(doc: jsPDF) {
  try {
    const response = await fetch('/logo-dark.svg')
    if (!response.ok) return false
    doc.addSvgAsImage(await response.text(), 20, 13, 17, 14)
    return true
  } catch {
    return false
  }
}

function drawFallbackLogo(doc: jsPDF) {
  doc.setFillColor(...colors.ink)
  doc.circle(28.5, 20, 7, 'F')
  doc.setTextColor(...colors.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('K', 28.5, 23, { align: 'center' })
}

/** Creates an informative payment request document; it is not a fiscal invoice. */
export async function createPaymentRequestDocument({
  letterId,
  letterName,
  clientName,
  concept,
  total,
  createdAt,
}: PaymentRequestDocumentInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  doc.setFillColor(...colors.cream)
  doc.rect(0, 0, 210, 297, 'F')
  doc.setFillColor(...colors.white)
  doc.roundedRect(12, 10, 186, 277, 3, 3, 'F')

  doc.setFillColor(...colors.ink)
  doc.roundedRect(12, 10, 186, 47, 3, 3, 'F')
  doc.rect(12, 45, 186, 12, 'F')
  if (!(await addBrandLogo(doc))) drawFallbackLogo(doc)
  doc.setTextColor(...colors.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('KACHE ENVÍOS', 42, 21)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Transporte de mascotas', 42, 28)
  doc.setTextColor(...colors.coral)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('DOCUMENTO NO FISCAL', 186, 25, { align: 'right' })

  doc.setTextColor(...colors.ink)
  doc.setFontSize(22)
  doc.text('Solicitud de pago', 24, 78)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...colors.muted)
  doc.setFontSize(9)
  doc.text('Resumen del servicio y del importe solicitado', 24, 87)
  doc.setDrawColor(...colors.coral)
  doc.setLineWidth(1.2)
  doc.line(24, 94, 186, 94)

  doc.setFillColor(...colors.cream)
  doc.roundedRect(24, 106, 162, 38, 2, 2, 'F')
  doc.setTextColor(...colors.muted)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('CLIENTE', 31, 116)
  doc.text('CARTA DE PORTE', 116, 116)
  doc.setTextColor(...colors.ink)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(clientName, 31, 126, { maxWidth: 72 })
  doc.text(letterId, 116, 126, { maxWidth: 62 })

  doc.setTextColor(...colors.muted)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('CONCEPTO', 24, 166)
  doc.setTextColor(...colors.ink)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(doc.splitTextToSize(concept, 162), 24, 178, { lineHeightFactor: 1.5 })

  doc.setFillColor(...colors.coral)
  doc.roundedRect(24, 207, 162, 42, 2, 2, 'F')
  doc.setTextColor(...colors.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('IMPORTE SOLICITADO', 32, 222)
  doc.setFontSize(21)
  doc.text(currency(total), 178, 236, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`Solicitud creada el ${date(createdAt)}`, 24, 266)
  doc.setTextColor(...colors.muted)
  doc.setFontSize(7.5)
  doc.text('Este documento es informativo y no sustituye a una factura.', 24, 276)
  doc.setDrawColor(...colors.line)
  doc.setLineWidth(0.3)
  doc.line(24, 281, 186, 281)
  doc.setFontSize(7)
  doc.text('KACHE ENVÍOS  ·  Gracias por confiar en nosotros', 24, 284)

  return {
    blob: doc.output('blob'),
    fileName: `solicitud-pago-${filePart((letterName || letterId).replace(/\.[^.]+$/, '')) || 'transporte'}.pdf`,
  }
}
