import { boxGridSpan, vanLanes } from './van'

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