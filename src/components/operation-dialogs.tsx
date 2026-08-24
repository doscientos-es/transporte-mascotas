import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronRight, FilePlus2, Printer, Route, Upload } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import type { Letter, RouteTemplate } from '../lib/types'

type OperationDialogProps = {
  children: ReactNode
  description: string
  icon: ReactNode
  onClose: () => void
  title: string
}

function OperationDialog({ children, description, icon, onClose, title }: OperationDialogProps) {
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="dialog-card !w-[calc(100%-2.5rem)] !max-w-[460px] !p-[26px]"><DialogHeader className="gap-0"><div className="dialog-icon">{icon}</div><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{children}</DialogContent></Dialog>
}

export function ImportDialog({ onClose, onPick }: { onClose: () => void; onPick: () => void }) {
  return <OperationDialog title="Importar carta de porte" description="Sube un PDF digital. Extraeremos el contenido y podrás revisarlo antes de guardarlo." icon={<FilePlus2 size={24} />} onClose={onClose}><button type="button" className="dropzone" onClick={onPick}><Upload size={24} /><strong>Seleccionar PDF</strong><span>Máximo 10 MB · solo PDF con texto</span></button><p className="hint">El identificador será el encabezado «CARTA DE PORTE Nº …».</p></OperationDialog>
}

export function InvoiceDialog({ letter, onClose, onGenerate }: { letter: Letter; onClose: () => void; onGenerate: (letter: Letter, payer: 'remitente' | 'destinatario' | 'third_party', total: number, thirdParty?: { fullName: string; phone: string }) => Promise<void> }) {
  const [payer, setPayer] = useState<'remitente' | 'destinatario' | 'third_party'>('remitente')
  const [thirdParty, setThirdParty] = useState({ fullName: '', phone: '' })
  const [total, setTotal] = useState('200')
  const [generating, setGenerating] = useState(false)
  const generate = () => {
    setGenerating(true)
    onGenerate(letter, payer, Number(total) || 0, payer === 'third_party' ? thirdParty : undefined).finally(() => {
      setGenerating(false)
      onClose()
    })
  }
  return <OperationDialog title="Preparar factura" description="Elige quién paga y ajusta el importe con IVA antes de generar la factura. Se guardará automáticamente en su ficha de cliente." icon={<Printer size={24} />} onClose={onClose}><div className="payer-options" role="radiogroup" aria-label="Persona que paga la factura"><button type="button" role="radio" aria-checked={payer === 'remitente'} className={payer === 'remitente' ? 'is-selected' : ''} onClick={() => setPayer('remitente')}><span>Remitente</span><strong>{letter.sender}</strong></button><button type="button" role="radio" aria-checked={payer === 'destinatario'} className={payer === 'destinatario' ? 'is-selected' : ''} onClick={() => setPayer('destinatario')}><span>Destinatario</span><strong>{letter.recipient}</strong></button><button type="button" role="radio" aria-checked={payer === 'third_party'} className={payer === 'third_party' ? 'is-selected' : ''} onClick={() => setPayer('third_party')}><span>Tercero</span><strong>Otra persona o empresa</strong></button></div>{payer === 'third_party' && <div className="client-form"><Label>Nombre o empresa<Input required value={thirdParty.fullName} onChange={(event) => setThirdParty({ ...thirdParty, fullName: event.target.value })} /></Label><Label>Teléfono<Input value={thirdParty.phone} onChange={(event) => setThirdParty({ ...thirdParty, phone: event.target.value })} /></Label></div>}<Label className="date-field">Total (IVA incluido)<Input type="number" min="0" step="0.01" value={total} onChange={(event) => setTotal(event.target.value)} /></Label><Button className="dialog-submit" disabled={generating || (payer === 'third_party' && !thirdParty.fullName.trim())} onClick={generate}><Printer /> {generating ? 'Generando…' : 'Generar factura'}</Button></OperationDialog>
}

export function NewRouteDialog({ templates, onClose, onCreate }: { templates: RouteTemplate[]; onClose: () => void; onCreate: (template: RouteTemplate, date: string) => void }) {
  const [date, setDate] = useState('2026-08-09')
  return <OperationDialog title="Crear ruta diaria" description="Se copiarán todas las paradas y se añadirán las recogidas y entregas compatibles con la fecha elegida." icon={<Route size={24} />} onClose={onClose}><Label className="date-field">Fecha de servicio<Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Label><div className="dialog-options">{templates.map((template) => <button type="button" key={template.id} onClick={() => onCreate(template, date)}><span className="template-dot" style={{ background: template.color }} /><span><strong>{template.name}</strong><small>{template.stops.length} paradas</small></span><ChevronRight size={17} /></button>)}</div></OperationDialog>
}
