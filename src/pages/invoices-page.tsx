import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CheckCircle2, CreditCard, Download, Eye, FileText, ReceiptText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageIntro } from '../components/page-intro'
import { downloadInvoice, previewInvoice } from '../lib/pdf'
import type { Client, ClientInvoice, Letter } from '../lib/types'

const currency = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)

export function InvoicesPage({ invoices, letters, clients, transportista, onSend }: { invoices: ClientInvoice[]; letters: Letter[]; clients: Client[]; transportista: boolean; onSend: (invoice: ClientInvoice, kind: 'solicitud_pago' | 'factura_emitida') => Promise<void> }) {
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<ClientInvoice | null>(null)
  const description = transportista
    ? 'Solicitudes y facturas vinculadas a los servicios de tu ruta asignada.'
    : 'Solicitudes de pago y facturas emitidas para los servicios de transporte.'

  async function send(invoice: ClientInvoice) {
    setPayingInvoiceId(invoice.id)
    try {
      await onSend(invoice, invoice.status === 'emitida' ? 'factura_emitida' : 'solicitud_pago')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se ha podido iniciar el pago.')
    } finally {
      setPayingInvoiceId(null)
    }
  }

  return <><PageIntro text={description} /><div className="invoices-list">{invoices.length ? invoices.map((invoice) => <Card key={invoice.id} className="invoice-card"><CardContent><div className="invoice-icon"><ReceiptText size={19} /></div><div><span>{invoice.status === 'emitida' ? 'Factura emitida tras el pago' : 'Solicitud de pago pendiente'}</span><strong>{invoice.concept}</strong><small><FileText size={13} /> {invoice.letterId}</small></div><div className="invoice-amount"><strong>{currency(invoice.total)}</strong><span>{new Date(invoice.createdAt).toLocaleDateString('es-ES')}</span></div>{invoice.status === 'emitida' && <span className="invoice-paid"><CheckCircle2 size={15} /> Emitida</span>}<Button size="sm" variant="outline" className="invoice-preview-button" onClick={() => setPreviewing(invoice)}><Eye size={15} /> Ver factura</Button>{!transportista && <Button size="sm" className="invoice-pay-button" disabled={payingInvoiceId === invoice.id} onClick={() => void send(invoice)}><CreditCard size={15} /> {payingInvoiceId === invoice.id ? 'Enviando…' : invoice.status === 'emitida' ? 'Reenviar factura' : 'Reenviar solicitud'}</Button>}</CardContent></Card>) : <Card className="invoice-empty"><CardContent><ReceiptText size={22} /><div><h3>No hay facturas disponibles</h3><p>{transportista ? 'Las facturas de los servicios de tu ruta aparecerán aquí.' : 'Las solicitudes y facturas aparecerán aquí.'}</p></div></CardContent></Card>}</div>{previewing && <InvoicePreviewDialog invoice={previewing} letter={letters.find((letter) => letter.id === previewing.letterId)} client={clients.find((client) => client.id === previewing.clientId)} onClose={() => setPreviewing(null)} />}</>
}

function InvoicePreviewDialog({ invoice, letter, client, onClose }: { invoice: ClientInvoice; letter?: Letter; client?: Client; onClose: () => void }) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!letter) { setError('No se han encontrado los datos de la carta para generar esta factura.'); setLoading(false); return }
    let objectUrl = ''
    previewInvoice(letter, invoice.payer, invoice.total, invoice.payer === 'manual' && client ? client : undefined)
      .then(({ url }) => { objectUrl = url.toString(); setPreviewUrl(objectUrl) })
      .catch(() => setError('No se ha podido preparar la vista previa de la factura.'))
      .finally(() => setLoading(false))
    // The PDF preview is generated in memory, so release its temporary URL when the dialog closes.
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [client, invoice.payer, invoice.total, letter])

  async function download() {
    if (!letter) return
    await downloadInvoice(letter, invoice.payer, invoice.total, invoice.payer === 'manual' && client ? client : undefined)
  }

  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="dialog-card !w-[calc(100%-2.5rem)] !max-w-[900px] !p-[26px]"><DialogHeader className="gap-0"><DialogTitle>Vista previa de factura</DialogTitle><DialogDescription>{invoice.letterId}</DialogDescription></DialogHeader>{loading && <p className="page-loading">Preparando factura…</p>}{error && <p className="form-error" role="alert">{error}</p>}{previewUrl && <iframe className="invoice-preview" src={previewUrl} title={`Vista previa de ${invoice.letterId}`} />}{previewUrl && <Button className="dialog-submit" onClick={() => void download()}><Download /> Descargar factura</Button>}</DialogContent></Dialog>
}
