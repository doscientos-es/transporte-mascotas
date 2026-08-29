import { Button, Card, CardContent } from '@doscientos/ui'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@doscientos/ui'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  FileText,
  ReceiptText,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { Client, ClientInvoice, ManualPaymentMethod } from '@/shared/types'
import { PageIntro } from '@/shared/ui/page-intro'

import { prepareInvoiceDocument } from '../application/invoice-preview'

const PAGE_SIZE = 12
const currency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)

export function InvoicesPage({
  invoices,
  clients,
  transportista,
  onSend,
  onConfirmManualPayment,
}: {
  invoices: ClientInvoice[]
  clients: Client[]
  transportista: boolean
  onSend: (invoice: ClientInvoice, kind: 'solicitud_pago' | 'factura_emitida') => Promise<void>
  onConfirmManualPayment?: (invoice: ClientInvoice, method: ManualPaymentMethod) => Promise<void>
}) {
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<ClientInvoice | null>(null)
  const [manualPayment, setManualPayment] = useState<ClientInvoice | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'todas' | ClientInvoice['status']>('todas')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const filteredInvoices = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return invoices.filter((invoice) => {
      const clientName =
        invoice.clientName ||
        clients.find((client) => client.id === invoice.clientId)?.fullName ||
        ''
      const date = invoice.issuedInvoice?.issuedAt ?? invoice.createdAt
      return (
        (status === 'todas' || invoice.status === status) &&
        (!from || date.slice(0, 10) >= from) &&
        (!to || date.slice(0, 10) <= to) &&
        (!term ||
          [
            invoice.issuedInvoice?.number,
            invoice.letterId,
            invoice.concept,
            clientName,
            invoice.status,
          ]
            .join(' ')
            .toLocaleLowerCase()
            .includes(term))
      )
    })
  }, [clients, from, invoices, query, status, to])
  const pageCount = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleInvoices = filteredInvoices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )
  const resetPage = () => setPage(1)
  async function send(invoice: ClientInvoice) {
    setSendingInvoiceId(invoice.id)
    try {
      await onSend(invoice, invoice.status === 'emitida' ? 'factura_emitida' : 'solicitud_pago')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se ha podido enviar el documento.')
    } finally {
      setSendingInvoiceId(null)
    }
  }
  async function download(invoice: NonNullable<ClientInvoice['issuedInvoice']>) {
    const downloadWindow = window.open('', '_blank')
    if (!downloadWindow)
      return window.alert('Permite las ventanas emergentes para descargar la factura.')
    downloadWindow.opener = null
    setDownloadingInvoiceId(invoice.invoiceDraftId)
    try {
      const document = await prepareInvoiceDocument(invoice.invoiceDraftId)
      if (!document) throw new Error('No se ha podido preparar la descarga de la factura.')
      downloadWindow.location.replace(`${document.url}&download=1`)
    } catch (error) {
      downloadWindow.close()
      window.alert(error instanceof Error ? error.message : 'No se ha podido descargar la factura.')
    } finally {
      setDownloadingInvoiceId(null)
    }
  }
  return (
    <>
      <PageIntro
        text={
          transportista
            ? 'Consulta las solicitudes y facturas vinculadas a tus servicios asignados.'
            : 'Gestiona solicitudes de pago y facturas emitidas. Solo las facturas emitidas se pueden descargar.'
        }
      />
      <div className="invoice-filters" aria-label="Filtros de facturas">
        <label>
          Buscar
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              resetPage()
            }}
            placeholder="Nº, cliente, carta o concepto"
          />
        </label>
        <label>
          Estado
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as typeof status)
              resetPage()
            }}
          >
            <option value="todas">Todos</option>
            <option value="solicitud_pago">Solicitud de pago</option>
            <option value="emitida">Emitida</option>
          </select>
        </label>
        <label>
          Desde
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value)
              resetPage()
            }}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value)
              resetPage()
            }}
          />
        </label>
      </div>
      <div className="invoice-results" aria-live="polite">
        <span>
          {filteredInvoices.length} {filteredInvoices.length === 1 ? 'resultado' : 'resultados'}
        </span>
        {!transportista && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadInvoiceRegister(filteredInvoices, clients)}
          >
            <Download size={15} /> Exportar CSV
          </Button>
        )}
      </div>
      <div className="invoices-list">
        {visibleInvoices.length ? (
          visibleInvoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              clientName={
                invoice.clientName ||
                clients.find((client) => client.id === invoice.clientId)?.fullName ||
                'Cliente'
              }
              transportista={transportista}
              sending={sendingInvoiceId === invoice.id}
              downloading={downloadingInvoiceId === invoice.id}
              onPreview={() => setPreviewing(invoice)}
              onDownload={() => invoice.issuedInvoice && void download(invoice.issuedInvoice)}
              onSend={() => void send(invoice)}
              onManualPayment={() => setManualPayment(invoice)}
            />
          ))
        ) : (
          <Card className="invoice-empty">
            <CardContent>
              <ReceiptText size={22} />
              <div>
                <h3>No hay facturas disponibles</h3>
                <p>
                  Prueba a cambiar los filtros o crea una solicitud de pago desde una carta de
                  porte.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      {filteredInvoices.length > PAGE_SIZE && (
        <nav className="invoice-pagination" aria-label="Paginación de facturas">
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            <ChevronLeft /> Anterior
          </Button>
          <span>
            Página {currentPage} de {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            Siguiente <ChevronRight />
          </Button>
        </nav>
      )}
      {previewing?.issuedInvoice && (
        <InvoicePreviewDialog
          invoice={previewing.issuedInvoice}
          onClose={() => setPreviewing(null)}
        />
      )}
      {manualPayment && onConfirmManualPayment && (
        <ManualPaymentDialog
          invoice={manualPayment}
          onClose={() => setManualPayment(null)}
          onConfirm={onConfirmManualPayment}
        />
      )}
    </>
  )
}

function downloadInvoiceRegister(invoices: ClientInvoice[], clients: Client[]) {
  const cell = (value: unknown) => {
    const text =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : ''
    return `"${text.replaceAll('"', '""')}"`
  }
  const header = [
    'Número',
    'Estado',
    'Fecha',
    'Cliente',
    'NIF/CIF',
    'Carta de porte',
    'Concepto',
    'Base',
    'IVA',
    'Total',
  ]
  const rows = invoices.map((invoice) => {
    const fiscal = invoice.issuedInvoice?.fiscalSnapshot
    const client = fiscal?.client
    return [
      invoice.issuedInvoice?.number ?? '',
      invoice.status,
      invoice.issuedInvoice?.issuedAt ?? invoice.createdAt,
      client?.fullName ??
        invoice.clientName ??
        clients.find((item) => item.id === invoice.clientId)?.fullName ??
        '',
      client?.nif ?? '',
      invoice.letterId,
      fiscal?.concept ?? invoice.concept,
      fiscal?.net_amount ?? '',
      fiscal?.vat_amount ?? '',
      invoice.total,
    ]
  })
  const url = URL.createObjectURL(
    new Blob([[header, ...rows].map((row) => row.map(cell).join(';')).join('\n')], {
      type: 'text/csv;charset=utf-8',
    }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `registro-facturacion-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function InvoiceCard({
  invoice,
  clientName,
  transportista,
  sending,
  downloading,
  onPreview,
  onDownload,
  onSend,
  onManualPayment,
}: {
  invoice: ClientInvoice
  clientName: string
  transportista: boolean
  sending: boolean
  downloading: boolean
  onPreview: () => void
  onDownload: () => void
  onSend: () => void
  onManualPayment: () => void
}) {
  const issued = invoice.status === 'emitida' ? invoice.issuedInvoice : undefined
  const isIssued = invoice.status === 'emitida'
  return (
    <Card className="invoice-card">
      <CardContent>
        <div className="invoice-card-main">
          <div className="invoice-card-identity">
            <div className="invoice-icon">
              <ReceiptText size={19} />
            </div>
            <div className="invoice-card-details">
              <span className="invoice-type">
                {isIssued ? 'Factura emitida' : 'Solicitud de pago'}
              </span>
              <strong title={issued?.number ?? invoice.concept}>
                {issued?.number ?? invoice.concept}
              </strong>
              <small>
                <FileText size={13} />
                <span>{clientName}</span>
                <span aria-hidden="true">·</span>
                <span className="invoice-reference">{invoice.letterId}</span>
              </small>
            </div>
          </div>
          <div className="invoice-card-financial">
            <div className="invoice-amount">
              <strong>{currency(invoice.total)}</strong>
              <span>
                {new Date(issued?.issuedAt ?? invoice.createdAt).toLocaleDateString('es-ES')}
              </span>
            </div>
            {isIssued ? (
              <span className="invoice-status invoice-paid">
                <CheckCircle2 size={15} /> Emitida
              </span>
            ) : (
              <span className="invoice-status invoice-pending">Pendiente de cobro</span>
            )}
          </div>
        </div>
        {(issued || !transportista) && (
          <div className="invoice-card-actions">
            {issued && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="invoice-preview-button"
                  onClick={onPreview}
                >
                  <Eye size={15} /> Ver factura
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="invoice-download-button"
                  disabled={downloading}
                  onClick={onDownload}
                  aria-label="Descargar factura"
                >
                  <Download size={15} />
                </Button>
              </>
            )}
            {!transportista && !isIssued && (
              <Button size="sm" variant="outline" disabled={sending} onClick={onManualPayment}>
                <CheckCircle2 size={15} /> Registrar cobro
              </Button>
            )}
            {!transportista && (
              <Button size="sm" className="invoice-pay-button" disabled={sending} onClick={onSend}>
                <CreditCard size={15} />{' '}
                {sending ? 'Enviando…' : isIssued ? 'Reenviar factura' : 'Reenviar solicitud'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InvoicePreviewDialog({
  invoice,
  onClose,
}: {
  invoice: NonNullable<ClientInvoice['issuedInvoice']>
  onClose: () => void
}) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    prepareInvoiceDocument(invoice.invoiceDraftId)
      .then((document) => {
        if (active) setPreviewUrl(document?.url ?? '')
      })
      .catch(() => {
        if (active) setError('No se ha podido preparar la vista previa de la factura.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [invoice.invoiceDraftId])
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="dialog-card !w-[calc(100%-2.5rem)] !max-w-[900px] !p-[26px]">
        <DialogHeader className="gap-0">
          <DialogTitle>Factura {invoice.number}</DialogTitle>
          <DialogDescription>
            Documento creado desde la instantánea fiscal emitida.
          </DialogDescription>
        </DialogHeader>
        {loading && <p className="page-loading">Preparando factura…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {previewUrl && (
          <iframe
            className="invoice-preview"
            src={previewUrl}
            title={`Vista previa de la factura ${invoice.number}`}
          />
        )}
        {previewUrl && (
          <Button
            className="dialog-submit"
            onClick={() => window.open(`${previewUrl}&download=1`, '_blank', 'noopener,noreferrer')}
          >
            <Download /> Descargar factura
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ManualPaymentDialog({
  invoice,
  onClose,
  onConfirm,
}: {
  invoice: ClientInvoice
  onClose: () => void
  onConfirm: (invoice: ClientInvoice, method: ManualPaymentMethod) => Promise<void>
}) {
  const [method, setMethod] = useState<ManualPaymentMethod>('Transferencia')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    setSaving(true)
    setError('')
    try {
      await onConfirm(invoice, method)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido registrar el cobro.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="dialog-card">
        <DialogHeader className="gap-0">
          <DialogTitle>Registrar cobro manual</DialogTitle>
          <DialogDescription>
            Se emitirá y numerará la factura {invoice.letterId}. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <label className="date-field">
          Método de cobro
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as ManualPaymentMethod)}
          >
            <option>Transferencia</option>
            <option>Efectivo</option>
            <option>Bizum</option>
            <option>Tarjeta</option>
            <option>Otro</option>
          </select>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button className="dialog-submit" disabled={saving} onClick={() => void confirm()}>
          <CheckCircle2 /> {saving ? 'Emitiendo…' : 'Confirmar cobro y emitir'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
