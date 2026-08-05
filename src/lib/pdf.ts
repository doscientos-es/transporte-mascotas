import { boxGridSpan, vanLanes } from './van'

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
      const label = assignments.find((entry) => entry.box === box)?.label
      if (label) { doc.setFont('helvetica', 'normal'); doc.setFontSize(4.5); doc.text(label.replace('CARTA DE PORTE Nº ', '#'), x + laneWidth / 2, y + h / 2, { align: 'center', maxWidth: laneWidth - 5 }) }
      row += span
    })
  })
  const aisleX = startX + 4 * laneWidth
  doc.setDrawColor(80, 80, 80); doc.setLineWidth(.25); doc.rect(aisleX, bodyY, aisleWidth, bodyHeight)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('P A S I L L O', aisleX + aisleWidth / 2, bodyY + bodyHeight / 2, { align: 'center' })
  doc.save(`furgon-${routeName.toLowerCase().replaceAll(' ', '-')}.pdf`)
}
