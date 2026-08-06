import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, CreditCard, FileText, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { PageIntro } from '../components/page-intro'
import type { ClientInvoice } from '../lib/types'

const currency = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)

export function InvoicesPage({ invoices, transportista, onSend }: { invoices: ClientInvoice[]; transportista: boolean; onSend: (invoice: ClientInvoice, kind: 'solicitud_pago' | 'factura_emitida') => Promise<void> }) {
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null)
  const description = transportista
    ? 'Solicitudes y facturas vinculadas a los servicios de tu ruta asignada.'
    : 'Solicitudes de pago y facturas emitidas para los servicios de transporte.'

  async function send(invoice: ClientInvoice) {
    setPayingInvoiceId(invoice.id)
    try {
      await onSend(invoice, invoice.status === 'emitida' ? 'factura_emitida' : 'solicitud_pago')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se ha podido iniciar el pago.')
      setPayingInvoiceId(null)
    }
  }

  return <><PageIntro text={description} /><div className="invoices-list">{invoices.length ? invoices.map((invoice) => <Card key={invoice.id} className="invoice-card"><CardContent><div className="invoice-icon"><ReceiptText size={19} /></div><div><span>{invoice.status === 'emitida' ? 'Factura emitida tras el pago' : 'Solicitud de pago pendiente'}</span><strong>{invoice.concept}</strong><small><FileText size={13} /> {invoice.letterId}</small></div><div className="invoice-amount"><strong>{currency(invoice.total)}</strong><span>{new Date(invoice.createdAt).toLocaleDateString('es-ES')}</span></div>{invoice.status === 'emitida' && <span className="invoice-paid"><CheckCircle2 size={15} /> Emitida</span>}{!transportista && <Button size="sm" className="invoice-pay-button" disabled={payingInvoiceId === invoice.id} onClick={() => void send(invoice)}><CreditCard size={15} /> {payingInvoiceId === invoice.id ? 'Enviando…' : invoice.status === 'emitida' ? 'Reenviar factura' : 'Reenviar solicitud'}</Button>}</CardContent></Card>) : <Card className="invoice-empty"><CardContent><ReceiptText size={22} /><div><h3>No hay facturas disponibles</h3><p>{transportista ? 'Las facturas de los servicios de tu ruta aparecerán aquí.' : 'Las solicitudes y facturas aparecerán aquí.'}</p></div></CardContent></Card>}</div></>
}
