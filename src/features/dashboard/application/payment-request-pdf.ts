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
  const contentWidth = 170

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('KACHE ENVÍOS', 20, 24)
  doc.setFontSize(22)
  doc.text('SOLICITUD DE PAGO', 20, 43)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Documento informativo · No es una factura', 20, 51)
  doc.setDrawColor(210, 210, 210)
  doc.line(20, 58, 190, 58)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Cliente', 20, 72)
  doc.text('Carta de porte', 110, 72)
  doc.setFont('helvetica', 'normal')
  doc.text(clientName, 20, 79, { maxWidth: 75 })
  doc.text(letterId, 110, 79, { maxWidth: 75 })

  doc.setFont('helvetica', 'bold')
  doc.text('Concepto', 20, 97)
  doc.setFont('helvetica', 'normal')
  doc.text(doc.splitTextToSize(concept, contentWidth), 20, 104)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Importe solicitado', 20, 137)
  doc.setFontSize(16)
  doc.text(currency(total), 190, 137, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Solicitud creada el ${date(createdAt)}.`, 20, 151)

  return {
    blob: doc.output('blob'),
    fileName: `solicitud-pago-${filePart((letterName || letterId).replace(/\.[^.]+$/, '')) || 'transporte'}.pdf`,
  }
}
