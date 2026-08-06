import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronRight, FilePlus2, Printer, Route, Upload } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import type { DailyRoute, InvoiceClientInput, InvoicePayer, Letter, RouteTemplate, Transporter } from '../lib/types'

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

export function ImportDialog({ file, routes, templates, onClose, onPick, onFile, onImport }: { file: File | null; routes: DailyRoute[]; templates: RouteTemplate[]; onClose: () => void; onPick: () => void; onFile: (file?: File) => void; onImport: (file: File, routeId: string, dogCount: number) => Promise<void> }) {
  const [routeId, setRouteId] = useState('')
  const [dogCount, setDogCount] = useState('1')
  const [importing, setImporting] = useState(false)
  const selectedRoute = routes.find((route) => route.id === routeId)
  async function submit() {
    if (!file || !routeId) return
    setImporting(true)
    try { await onImport(file, routeId, Math.max(1, Number(dogCount) || 1)) } finally { setImporting(false) }
  }
  return <OperationDialog title="Importar carta de porte" description={file ? 'Elige la ruta diaria a la que pertenece la carta antes de incorporarla.' : 'Suelta un PDF digital o selecciónalo desde tu equipo.'} icon={<FilePlus2 size={24} />} onClose={onClose}>{file ? <><div className="import-selected"><FilePlus2 size={18} /><span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></span><Button variant="outline" size="sm" onClick={onPick}>Cambiar</Button></div><Label className="date-field">Ruta diaria<select value={routeId} onChange={(event) => setRouteId(event.target.value)} autoComplete="off"><option value="">Selecciona una ruta…</option>{routes.map((route) => <option value={route.id} key={route.id}>{templates.find((template) => template.id === route.templateId)?.name ?? 'Ruta sin plantilla'} · {new Date(`${route.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</option>)}</select></Label>{selectedRoute && <p className="hint">Fecha de servicio: <strong>{new Date(`${selectedRoute.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>}<Label className="date-field">Número de perros<Input type="number" min="1" step="1" value={dogCount} onChange={(event) => setDogCount(event.target.value)} /></Label><Button className="dialog-submit" disabled={importing || !routeId} onClick={submit}><FilePlus2 /> {importing ? 'Importando…' : 'Confirmar e importar'}</Button></> : <><button type="button" className="dropzone" onClick={onPick} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onFile(event.dataTransfer.files?.[0]) }}><Upload size={24} /><strong>Soltar PDF o seleccionar archivo</strong><span>Máximo 10 MB · solo PDF con texto</span></button><p className="hint">Después seleccionarás la ruta diaria y cuántos perros incluye.</p></>}</OperationDialog>
}

const emptyInvoiceClient: InvoiceClientInput = { fullName: '', nif: '', email: '', phone: '', address: '', city: '', postalCode: '' }

export function InvoiceDialog({ letter, onClose, onGenerate }: { letter: Letter; onClose: () => void; onGenerate: (letter: Letter, payer: InvoicePayer, total: number, manualClient?: InvoiceClientInput) => Promise<void> }) {
  const [payer, setPayer] = useState<InvoicePayer>('remitente')
  const [total, setTotal] = useState('200')
  const [generating, setGenerating] = useState(false)
  const [manualClient, setManualClient] = useState<InvoiceClientInput>(emptyInvoiceClient)
  const [error, setError] = useState('')
  const updateManualClient = (field: keyof InvoiceClientInput, value: string) => setManualClient((current) => ({ ...current, [field]: value }))
  const selectPayer = (nextPayer: InvoicePayer) => { setPayer(nextPayer); setError('') }
  const generate = async () => {
    if (payer === 'manual' && !manualClient.fullName.trim()) return setError('Indica la razón social o el nombre de la persona a facturar.')
    setGenerating(true)
    try {
      await onGenerate(letter, payer, Number(total) || 0, payer === 'manual' ? manualClient : undefined)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido generar la factura.')
    } finally { setGenerating(false) }
  }
  return <OperationDialog title="Preparar factura" description="Elige el titular de la factura y ajusta el importe con IVA. La factura quedará vinculada a su ficha de cliente." icon={<Printer size={24} />} onClose={onClose}><div className="payer-options" role="radiogroup" aria-label="Titular de la factura"><button type="button" role="radio" aria-checked={payer === 'remitente'} className={payer === 'remitente' ? 'is-selected' : ''} onClick={() => selectPayer('remitente')}><span>Remitente</span><strong>{letter.sender}</strong></button><button type="button" role="radio" aria-checked={payer === 'destinatario'} className={payer === 'destinatario' ? 'is-selected' : ''} onClick={() => selectPayer('destinatario')}><span>Destinatario</span><strong>{letter.recipient}</strong></button><button type="button" role="radio" aria-checked={payer === 'manual'} className={payer === 'manual' ? 'is-selected' : ''} onClick={() => selectPayer('manual')}><span>Empresa u otro</span><strong>Introducir datos</strong></button></div>{payer === 'manual' && <div className="client-form invoice-client-form"><Label className="form-span">Razón social o nombre<Input value={manualClient.fullName} onChange={(event) => updateManualClient('fullName', event.target.value)} required /></Label><Label>NIF / CIF<Input value={manualClient.nif} onChange={(event) => updateManualClient('nif', event.target.value)} /></Label><Label>Teléfono<Input value={manualClient.phone} onChange={(event) => updateManualClient('phone', event.target.value)} /></Label><Label className="form-span">Dirección<Input value={manualClient.address} onChange={(event) => updateManualClient('address', event.target.value)} /></Label><Label>Código postal<Input value={manualClient.postalCode} onChange={(event) => updateManualClient('postalCode', event.target.value)} /></Label><Label>Ciudad<Input value={manualClient.city} onChange={(event) => updateManualClient('city', event.target.value)} /></Label><Label className="form-span">Email<Input type="email" value={manualClient.email} onChange={(event) => updateManualClient('email', event.target.value)} /></Label></div>}<Label className="date-field">Total (IVA incluido)<Input type="number" min="0" step="0.01" value={total} onChange={(event) => setTotal(event.target.value)} /></Label>{error && <p className="form-error" role="alert">{error}</p>}<Button className="dialog-submit" disabled={generating} onClick={generate}><Printer /> {generating ? 'Generando…' : 'Generar factura'}</Button></OperationDialog>
}

export function NewRouteDialog({ templates, transporters, onClose, onCreate }: { templates: RouteTemplate[]; transporters: Transporter[]; onClose: () => void; onCreate: (template: RouteTemplate, date: string, transporterId?: string) => void }) {
  const [date, setDate] = useState('2026-08-09')
  const [transporterId, setTransporterId] = useState('')
  return <OperationDialog title="Crear ruta diaria" description="Se copiarán todas las paradas y se añadirán las recogidas y entregas compatibles con la fecha elegida." icon={<Route size={24} />} onClose={onClose}><Label className="date-field">Fecha de servicio<Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Label><Label className="date-field">Asignar a transportista<select value={transporterId} onChange={(event) => setTransporterId(event.target.value)}><option value="">Sin asignar</option>{transporters.map((transporter) => <option value={transporter.id} key={transporter.id}>{transporter.displayName}</option>)}</select></Label><div className="dialog-options">{templates.map((template) => <button type="button" key={template.id} onClick={() => onCreate(template, date, transporterId || undefined)}><span className="template-dot" style={{ background: template.color }} /><span><strong>{template.name}</strong><small>{template.stops.length} paradas</small></span><ChevronRight size={17} /></button>)}</div></OperationDialog>
}
