import { boxSize } from './van'

export async function downloadInvoice(letterId: string, customer: string, total: number) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const base = total / 1.21
  const tax = total - base
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(26); doc.text('Borrador de factura', 14, 18)
  doc.setFontSize(10); doc.text(['EMISOR', 'Kache Envíos', 'NIF: 80156982G', 'Ctra. Pedroche s/n km 1,5', '14400 Pozoblanco, Córdoba', 'transportedemascotas@kacheenvios.com'], 14, 29)
  doc.setFontSize(11); doc.setTextColor(239, 68, 68); doc.text('CLIENTE', 14, 74); doc.text('REFERENCIA', 142, 74)
  doc.setTextColor(23, 23, 23); doc.setFontSize(11); doc.text(customer, 14, 83); doc.text(`BORRADOR/${new Date().getFullYear()}/${letterId.slice(-3)}`, 142, 83)
  doc.setDrawColor(239, 68, 68); doc.setFillColor(239, 68, 68); doc.rect(14, 107, 182, 8, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.text('CONCEPTO', 16, 112); doc.text('CANT.', 130, 112); doc.text('PRECIO', 148, 112); doc.text('IVA', 171, 112); doc.text('BASE', 183, 112)
  doc.setTextColor(23, 23, 23); doc.setFontSize(10); doc.text('Servicio de transporte de mascota', 16, 124); doc.text('1', 132, 124); doc.text(`${base.toFixed(2)} €`, 145, 124); doc.text('21 %', 172, 124); doc.text(`${base.toFixed(2)} €`, 183, 124)
  doc.setFontSize(12); doc.text(`BASE IMPONIBLE     ${base.toFixed(2)} €`, 130, 144); doc.text(`IVA general (21 %)  ${tax.toFixed(2)} €`, 130, 152)
  doc.setFontSize(17); doc.text(`Total   ${total.toFixed(2)} €`, 130, 166)
  doc.setFontSize(11); doc.text('COBROS / VENCIMIENTOS', 14, 187); doc.setFontSize(9); doc.text(['FECHA', new Date().toLocaleDateString('es-ES'), 'MÉTODO DE PAGO', 'Transferencia', 'CUENTA DESTINO', 'ES19 2100 2093 9702 0016 6247'], 14, 198)
  doc.setFontSize(8); doc.text('BORRADOR / PROFORMA - NO CONSTITUYE FACTURA FISCAL', 14, 270)
  doc.save(`borrador-${letterId.slice(-3)}.pdf`)
}

export async function downloadVanManifest(assignments: Array<{ box: number; label: string }>, routeName: string) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFontSize(30); doc.text('FURGÓN', 148, 17, { align: 'center' })
  doc.setFontSize(10); doc.text(`PARTE DELANTERA (CONDUCTORES) · ${routeName}`, 148, 25, { align: 'center' })
  const boxes = Array.from({ length: 72 }, (_, index) => index + 1)
  boxes.forEach((box, index) => {
    const col = index % 12; const row = Math.floor(index / 12)
    const x = 12 + col * 23; const y = 35 + row * 25
    const size = boxSize(box); const fill = size === 'grande' ? [183, 183, 183] : size === 'mediano' ? [255, 198, 185] : [222, 246, 226]
    doc.setFillColor(fill[0], fill[1], fill[2]); doc.rect(x, y, 21, 23, 'FD')
    doc.setFontSize(8); doc.text(String(box), x + 2, y + 5)
    const label = assignments.find((entry) => entry.box === box)?.label
    if (label) { doc.setFontSize(5); doc.text(label.replace('CARTA DE PORTE Nº ', '#'), x + 10.5, y + 13, { align: 'center', maxWidth: 17 }) }
  })
  doc.save(`furgon-${routeName.toLowerCase().replaceAll(' ', '-')}.pdf`)
}
