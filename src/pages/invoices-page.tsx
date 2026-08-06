import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, CreditCard, FileText, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { PageIntro } from '../components/page-intro'
import type { ClientInvoice } from '../lib/types'

const currency = (amount: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)

export function InvoicesPage({ invoices, transportista, onPay }: { invoices: ClientInvoice[]; transportista: boolean; onPay: (invoice: ClientInvoice) => Promise<void> }) {
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null)
  const description = transportista
    ? 'Facturas vinculadas a los servicios de tu ruta asignada.'
    : 'Consulta las facturas generadas para los servicios de transporte.'

  async function pay(invoice: ClientInvoice) {
    setPayingInvoiceId(invoice.id)
    try {
      await onPay(invoice)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se ha podido iniciar el pago.')
      setPayingInvoiceId(null)
    }
  }

  return <><PageIntro text={description} /><div className="invoices-list">{invoices.length ? invoices.map((invoice) => <Card key={invoice.id} className="invoice-card"><CardContent><div className="invoice-icon"><ReceiptText size={19} /></div><div><span>{invoice.status === 'pagada' ? 'Factura pagada' : 'Factura pendiente de pago'}</span><strong>{invoice.concept}</strong><small><FileText size={13} /> {invoice.letterId}</small></div><div className="invoice-amount"><strong>{currency(invoice.total)}</strong><span>{new Date(invoice.createdAt).toLocaleDateString('es-ES')}</span></div>{invoice.status === 'pagada' ? <span className="invoice-paid"><CheckCircle2 size={15} /> Pagada</span> : !transportista && <Button size="sm" className="invoice-pay-button" disabled={payingInvoiceId === invoice.id} onClick={() => void pay(invoice)}><CreditCard size={15} /> {payingInvoiceId === invoice.id ? 'Abriendo…' : 'Pagar con Bizum'}</Button>}</CardContent></Card>) : <Card className="invoice-empty"><CardContent><ReceiptText size={22} /><div><h3>No hay facturas disponibles</h3><p>{transportista ? 'Las facturas de los servicios de tu ruta aparecerán aquí.' : 'Las facturas generadas aparecerán aquí.'}</p></div></CardContent></Card>}</div></>
}
