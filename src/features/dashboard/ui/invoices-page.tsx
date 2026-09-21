import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Pagination,
} from '@doscientos/ui'
import { CheckCircle2, Download, Eye, FileText, ReceiptText } from 'lucide-react'
import { useEffect, useState } from 'react'

import { readEnumParam, readPageParam } from '@/shared/lib/search-params'
import type { ClientInvoice, ManualPaymentMethod, PaginatedResult } from '@/shared/types'
import { BrandLogo } from '@/shared/ui/brand-logo'
import { useUrlParams } from '@/shared/ui/use-url-params'

import { prepareInvoiceDocument } from '../application/invoice-preview'
import {
  INVOICE_LIST_PAGE_SIZE,
  invoiceSortOptions,
  loadInvoicePage,
  type InvoiceSort,
  type SortDirection,
} from '../application/paginated-lists'
import { paymentRequestLetterName } from '../application/payment-request-letter-name'
import { createPaymentRequestDocument } from '../application/payment-request-pdf'

const sortDirections = ['asc', 'desc'] as const
const currency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)

export function InvoicesPage({
  transportista,
  documentType,
  onConfirmManualPayment,
  onPaymentConfirmed,
  onOpenClient,
  onOpenLetter,
}: {
  transportista: boolean
  documentType: 'payment-requests' | 'invoices'
  onConfirmManualPayment?: (invoice: ClientInvoice, method: ManualPaymentMethod) => Promise<void>
  onPaymentConfirmed?: (invoice: ClientInvoice) => void
  onOpenClient?: (clientId: string) => void
  onOpenLetter?: (letterId: string) => void
}) {
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<PaginatedResult<ClientInvoice>>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const { searchParams, updateParams } = useUrlParams()
  const query = searchParams.get('q') ?? searchParams.get('letter') ?? ''
  const isPaymentRequests = documentType === 'payment-requests'
  const documentStatus = isPaymentRequests ? 'solicitud_pago' : 'emitida'
  const from = searchParams.get('desde') ?? ''
  const to = searchParams.get('hasta') ?? ''
  const sort = readEnumParam(searchParams.get('orden'), invoiceSortOptions, 'date')
  const direction = readEnumParam(searchParams.get('direccion'), sortDirections, 'desc')
  const requestedPage = readPageParam(searchParams.get('pagina'))
  const pageCount = Math.max(1, Math.ceil(result.total / INVOICE_LIST_PAGE_SIZE))
  const currentPage = Math.min(requestedPage, pageCount)
  const invoices = result.items
  const firstRecord = result.total === 0 ? 0 : (currentPage - 1) * INVOICE_LIST_PAGE_SIZE + 1
  const lastRecord = Math.min(currentPage * INVOICE_LIST_PAGE_SIZE, result.total)
  const visibleTotal = invoices.reduce((total, invoice) => total + invoice.total, 0)
  const previewing =
    invoices.find(
      (item) => item.id === (searchParams.get('factura') ?? searchParams.get('invoice')),
    ) ?? null
  const manualPayment = invoices.find((item) => item.id === searchParams.get('cobro')) ?? null
  const resetPage = () => ({ pagina: undefined })

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    loadInvoicePage({
      query: query.trim(),
      status: documentStatus,
      from,
      to,
      sort,
      direction,
      page: requestedPage,
    })
      .then((page) => {
        if (active) setResult(page)
      })
      .catch(() => {
        if (active) setError('No se han podido cargar las facturas.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [direction, documentStatus, from, query, refreshKey, requestedPage, sort, to])

  useEffect(() => {
    if (requestedPage > pageCount) updateParams({ pagina: pageCount === 1 ? undefined : pageCount })
  }, [pageCount, requestedPage, updateParams])

  async function exportRegister() {
    setExporting(true)
    try {
      const exportResult = await loadInvoicePage({
        query: query.trim(),
        status: documentStatus,
        from,
        to,
        sort,
        direction,
        page: 1,
        pageSize: 100000,
      })
      downloadInvoiceRegister(exportResult.items)
    } catch {
      window.alert('No se ha podido exportar el registro de facturas.')
    } finally {
      setExporting(false)
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
  async function downloadPaymentRequest(invoice: ClientInvoice, clientName: string) {
    setDownloadingInvoiceId(invoice.id)
    try {
      const letterName = await paymentRequestLetterName(invoice.letterId)
      const document = await createPaymentRequestDocument({
        letterId: invoice.letterId,
        letterName,
        clientName,
        concept: invoice.concept,
        total: invoice.total,
        createdAt: invoice.createdAt,
      })
      downloadBlob(document.blob, document.fileName)
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : 'No se ha podido descargar la solicitud de pago.',
      )
    } finally {
      setDownloadingInvoiceId(null)
    }
  }
  return (
    <>
      <section className="invoice-brand-hero" aria-label="Área de facturación Kache Envíos">
        <div className="invoice-brand-lockup">
          <div className="invoice-brand-logo-wrap">
            <BrandLogo variant="dark" className="invoice-brand-logo" />
          </div>
          <span>Kache Envíos</span>
        </div>
        <div className="invoice-brand-copy">
          <h2>{isPaymentRequests ? 'Solicitudes de pago' : 'Facturas de transporte'}</h2>
          <p>
            {isPaymentRequests
              ? 'Gestiona las solicitudes de pago creadas al dar de alta una carta de porte.'
              : transportista
                ? 'Consulta y descarga los documentos vinculados a tus servicios asignados.'
                : 'Consulta, descarga y reenvía las facturas emitidas tras confirmar cada cobro.'}
          </p>
        </div>
        <dl className="invoice-brand-summary" aria-label="Resumen de facturación">
          <div>
            <dt>Documentos</dt>
            <dd>{loading ? '—' : result.total}</dd>
          </div>
          <div>
            <dt>En esta página</dt>
            <dd>{loading ? '—' : invoices.length}</dd>
          </div>
          <div>
            <dt>Importe mostrado</dt>
            <dd>{loading ? '—' : currency(visibleTotal)}</dd>
          </div>
        </dl>
      </section>
      <section className="invoice-filter-surface" aria-label="Consulta de facturas">
        <div className="invoice-filter-heading">
          <div>
            <strong>Encuentra lo que necesitas</strong>
          </div>
          {!transportista && (
            <Button
              size="sm"
              variant="outline"
              disabled={exporting || result.total === 0}
              onClick={() => void exportRegister()}
            >
              <Download size={15} /> {exporting ? 'Exportando…' : 'Exportar CSV'}
            </Button>
          )}
        </div>
        <div className="invoice-filters">
          <label>
            Buscar
            <input
              value={query}
              onChange={(event) => {
                updateParams({ q: event.target.value, ...resetPage() })
              }}
              placeholder="Nº, cliente, carta o concepto"
            />
          </label>
          <label>
            Desde
            <input
              type="date"
              value={from}
              onChange={(event) => {
                updateParams({ desde: event.target.value, ...resetPage() })
              }}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={to}
              onChange={(event) => {
                updateParams({ hasta: event.target.value, ...resetPage() })
              }}
            />
          </label>
          <label>
            Ordenar por
            <select
              value={sort}
              onChange={(event) =>
                updateParams({ orden: event.target.value as InvoiceSort, ...resetPage() })
              }
            >
              <option value="date">Fecha</option>
              <option value="total">Importe</option>
              <option value="client">Cliente</option>
              <option value="status">Estado</option>
            </select>
          </label>
          <label>
            Dirección
            <select
              value={direction}
              onChange={(event) =>
                updateParams({ direccion: event.target.value as SortDirection, ...resetPage() })
              }
            >
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </label>
        </div>
      </section>
      <div className="invoice-results" aria-live="polite">
        <span>
          {loading
            ? 'Actualizando resultados…'
            : `${result.total} ${result.total === 1 ? 'resultado' : 'resultados'}`}
        </span>
      </div>
      <div className="invoices-list">
        {invoices.length ? (
          invoices.map((invoice) => {
            const clientName = invoice.clientName || 'Cliente'
            return (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                clientName={clientName}
                transportista={transportista}
                downloading={downloadingInvoiceId === invoice.id}
                onPreview={() => updateParams({ factura: invoice.id }, false)}
                onDownload={() =>
                  invoice.issuedInvoice
                    ? void download(invoice.issuedInvoice)
                    : void downloadPaymentRequest(invoice, clientName)
                }
                onManualPayment={() => updateParams({ cobro: invoice.id }, false)}
                onOpenClient={onOpenClient}
                onOpenLetter={onOpenLetter}
              />
            )
          })
        ) : (
          <Card className="invoice-empty">
            <CardContent>
              <ReceiptText size={22} />
              <div>
                <h3>No hay {isPaymentRequests ? 'solicitudes de pago' : 'facturas'} disponibles</h3>
                <p>
                  {error ||
                    (isPaymentRequests
                      ? 'Las solicitudes aparecerán automáticamente al crear una carta de porte.'
                      : 'Las facturas aparecerán automáticamente al confirmar los cobros.')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      {result.total > 0 && (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          ariaLabel="Paginación de facturas"
          onPageChange={(nextPage) =>
            updateParams({ pagina: nextPage === 1 ? undefined : nextPage })
          }
          summary={`Mostrando ${firstRecord}–${lastRecord} de ${result.total}`}
        />
      )}
      {previewing &&
        (previewing.issuedInvoice ? (
          <InvoicePreviewDialog
            invoice={previewing.issuedInvoice}
            onClose={() => updateParams({ factura: undefined })}
          />
        ) : (
          <PaymentRequestPreviewDialog
            invoice={previewing}
            clientName={previewing.clientName || 'Cliente'}
            onClose={() => updateParams({ factura: undefined })}
          />
        ))}
      {manualPayment && onConfirmManualPayment && (
        <ManualPaymentDialog
          invoice={manualPayment}
          onClose={() => updateParams({ cobro: undefined })}
          onConfirm={async (invoice, method) => {
            await onConfirmManualPayment(invoice, method)
            setRefreshKey((current) => current + 1)
          }}
          onConfirmed={() => onPaymentConfirmed?.({ ...manualPayment, status: 'emitida' })}
        />
      )}
    </>
  )
}

function downloadInvoiceRegister(invoices: ClientInvoice[]) {
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
      client?.fullName ?? invoice.clientName ?? '',
      client?.nif ?? invoice.clientNif ?? '',
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

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function InvoiceCard({
  invoice,
  clientName,
  transportista,
  downloading,
  onPreview,
  onDownload,
  onManualPayment,
  onOpenClient,
  onOpenLetter,
}: {
  invoice: ClientInvoice
  clientName: string
  transportista: boolean
  downloading: boolean
  onPreview: () => void
  onDownload: () => void
  onManualPayment: () => void
  onOpenClient?: (clientId: string) => void
  onOpenLetter?: (letterId: string) => void
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
                {onOpenClient && invoice.clientId ? (
                  <button
                    type="button"
                    className="invoice-card-link"
                    onClick={() => onOpenClient(invoice.clientId)}
                  >
                    {clientName}
                  </button>
                ) : (
                  <span>{clientName}</span>
                )}
                <span aria-hidden="true">·</span>
                {onOpenLetter ? (
                  <button
                    type="button"
                    className="invoice-card-link invoice-reference"
                    onClick={() => onOpenLetter(invoice.letterId)}
                  >
                    {invoice.letterId}
                  </button>
                ) : (
                  <span className="invoice-reference">{invoice.letterId}</span>
                )}
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
        <div className="invoice-card-actions">
          <Button
            size="sm"
            variant="outline"
            className="invoice-preview-button"
            onClick={onPreview}
          >
            <Eye size={15} /> {isIssued ? 'Ver factura' : 'Ver solicitud'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="invoice-download-button"
            disabled={downloading}
            onClick={onDownload}
          >
            <Download size={15} />{' '}
            {downloading ? 'Preparando…' : isIssued ? 'Descargar factura' : 'Descargar solicitud'}
          </Button>
          {!transportista && !isIssued && (
            <Button size="sm" variant="outline" onClick={onManualPayment}>
              <CheckCircle2 size={15} /> Registrar cobro
            </Button>
          )}
        </div>
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
      <DialogContent className="dialog-card invoice-preview-dialog">
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

function PaymentRequestPreviewDialog({
  invoice,
  clientName,
  onClose,
}: {
  invoice: ClientInvoice
  clientName: string
  onClose: () => void
}) {
  const [document, setDocument] = useState<{ blob: Blob; fileName: string; url: string } | null>(
    null,
  )
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let url = ''
    paymentRequestLetterName(invoice.letterId)
      .then((letterName) =>
        createPaymentRequestDocument({
          letterId: invoice.letterId,
          letterName,
          clientName,
          concept: invoice.concept,
          total: invoice.total,
          createdAt: invoice.createdAt,
        }),
      )
      .then((paymentRequest) => {
        if (!active) return
        url = URL.createObjectURL(paymentRequest.blob)
        setDocument({ ...paymentRequest, url })
      })
      .catch(() => {
        if (active) setError('No se ha podido preparar la vista previa de la solicitud.')
      })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [clientName, invoice.concept, invoice.createdAt, invoice.letterId, invoice.total])
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="dialog-card invoice-preview-dialog">
        <DialogHeader className="gap-0">
          <DialogTitle>Solicitud de pago {invoice.letterId}</DialogTitle>
          <DialogDescription>
            Documento informativo pendiente de cobro. No es una factura.
          </DialogDescription>
        </DialogHeader>
        {!document && !error && <p className="page-loading">Preparando solicitud…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {document && (
          <iframe
            className="invoice-preview"
            src={document.url}
            title={`Vista previa de la solicitud de pago ${invoice.letterId}`}
          />
        )}
        {document && (
          <Button
            className="dialog-submit"
            onClick={() => downloadBlob(document.blob, document.fileName)}
          >
            <Download /> Descargar solicitud
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
  onConfirmed,
}: {
  invoice: ClientInvoice
  onClose: () => void
  onConfirm: (invoice: ClientInvoice, method: ManualPaymentMethod) => Promise<void>
  onConfirmed?: () => void
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
      onConfirmed?.()
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
            <option>Bizum</option>
            <option>Tarjeta</option>
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
