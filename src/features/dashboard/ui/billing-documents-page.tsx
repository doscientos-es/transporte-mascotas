import { Button, Card, CardContent, Pagination, Tooltip } from '@doscientos/ui'
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Download, ReceiptText } from 'lucide-react'
import { useEffect, useState } from 'react'

import { readEnumParam, readPageParam } from '@/shared/lib/search-params'
import type { ClientInvoice, PaginatedResult } from '@/shared/types'
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
import { toggleSortDirection } from '../application/sort-direction'
import { BillingDocumentCard } from './billing-document-card'
import {
  InvoicePreviewDialog,
  ManualPaymentDialog,
  PaymentRequestPreviewDialog,
} from './billing-document-dialogs'
import { downloadBlob, downloadInvoiceRegister } from './billing-document-export'
import type { BillingDocumentMode, BillingDocumentsPageProps } from './billing-document-types'

const sortDirections = ['asc', 'desc'] as const

const pageCopy: Record<
  BillingDocumentMode,
  {
    status: 'solicitud_pago' | 'emitida'
    title: string
    description: string
    emptyTitle: string
    emptyDescription: string
    loadError: string
  }
> = {
  'payment-requests': {
    status: 'solicitud_pago',
    title: 'Solicitudes de pago',
    description: 'Pendientes de cobro y revisión.',
    emptyTitle: 'No hay solicitudes de pago disponibles',
    emptyDescription: 'Las solicitudes aparecerán automáticamente al crear una carta de porte.',
    loadError: 'No se han podido cargar las solicitudes de pago.',
  },
  invoices: {
    status: 'emitida',
    title: 'Facturas',
    description: 'Documentos emitidos y listos para consultar.',
    emptyTitle: 'No hay facturas disponibles',
    emptyDescription: 'Las facturas aparecerán automáticamente al confirmar los cobros.',
    loadError: 'No se han podido cargar las facturas.',
  },
}

export function BillingDocumentsPage({
  mode,
  transportista,
  onConfirmManualPayment,
  onPaymentConfirmed,
  onOpenClient,
  onOpenLetter,
}: BillingDocumentsPageProps & { mode: BillingDocumentMode }) {
  const copy = pageCopy[mode]
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<PaginatedResult<ClientInvoice>>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const { searchParams, updateParams } = useUrlParams()
  const query = searchParams.get('q') ?? searchParams.get('letter') ?? ''
  const from = searchParams.get('desde') ?? ''
  const to = searchParams.get('hasta') ?? ''
  const sort = readEnumParam(searchParams.get('orden'), invoiceSortOptions, 'date')
  const direction = readEnumParam(searchParams.get('direccion'), sortDirections, 'desc')
  const requestedPage = readPageParam(searchParams.get('pagina'))
  const pageCount = Math.max(1, Math.ceil(result.total / INVOICE_LIST_PAGE_SIZE))
  const currentPage = Math.min(requestedPage, pageCount)
  const firstRecord = result.total === 0 ? 0 : (currentPage - 1) * INVOICE_LIST_PAGE_SIZE + 1
  const lastRecord = Math.min(currentPage * INVOICE_LIST_PAGE_SIZE, result.total)
  const previewing = findByParam(
    result.items,
    searchParams.get('factura') ?? searchParams.get('invoice'),
  )
  const manualPayment = findByParam(result.items, searchParams.get('cobro'))
  const isPaymentRequests = mode === 'payment-requests'

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    loadInvoicePage({
      query: query.trim(),
      status: copy.status,
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
        if (active) setError(copy.loadError)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [copy.loadError, copy.status, direction, from, query, refreshKey, requestedPage, sort, to])

  useEffect(() => {
    if (requestedPage > pageCount) updateParams({ pagina: pageCount === 1 ? undefined : pageCount })
  }, [pageCount, requestedPage, updateParams])

  async function exportRegister() {
    setExporting(true)
    try {
      const exportResult = await loadInvoicePage({
        query: query.trim(),
        status: copy.status,
        from,
        to,
        sort,
        direction,
        page: 1,
        pageSize: 100000,
      })
      downloadInvoiceRegister(exportResult.items)
    } catch {
      setError('No se ha podido exportar el registro de facturación.')
    } finally {
      setExporting(false)
    }
  }

  async function downloadIssued(invoice: NonNullable<ClientInvoice['issuedInvoice']>) {
    const downloadWindow = window.open('', '_blank')
    if (!downloadWindow) {
      setError(
        'El navegador ha bloqueado la descarga. Permite las ventanas emergentes e inténtalo de nuevo.',
      )
      return
    }
    downloadWindow.opener = null
    setDownloadingId(invoice.invoiceDraftId)
    try {
      const document = await prepareInvoiceDocument(invoice.invoiceDraftId)
      if (!document) throw new Error('No se ha podido preparar la descarga de la factura.')
      downloadWindow.location.replace(`${document.url}&download=1`)
    } catch (reason) {
      downloadWindow.close()
      setError(reason instanceof Error ? reason.message : 'No se ha podido descargar la factura.')
    } finally {
      setDownloadingId(null)
    }
  }

  async function downloadPaymentRequest(invoice: ClientInvoice, clientName: string) {
    setDownloadingId(invoice.id)
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
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se ha podido descargar la solicitud de pago.',
      )
    } finally {
      setDownloadingId(null)
    }
  }

  function downloadDocument(invoice: ClientInvoice, clientName: string) {
    return mode === 'invoices' && invoice.issuedInvoice
      ? downloadIssued(invoice.issuedInvoice)
      : downloadPaymentRequest(invoice, clientName)
  }

  const updatePage = (page: number) => updateParams({ pagina: page === 1 ? undefined : page })
  const resetPage = { pagina: undefined }

  return (
    <>
      <section className="invoice-page-heading" aria-label={copy.title}>
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <div className="invoice-page-total">
          <strong>{loading ? '—' : result.total}</strong>
          <span>{result.total === 1 ? 'documento' : 'documentos'}</span>
        </div>
      </section>

      <section
        className="invoice-filter-surface"
        aria-label={`Consulta de ${copy.title.toLowerCase()}`}
      >
        <div className="invoice-filter-heading">
          <strong>Encuentra lo que necesitas</strong>
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
              onChange={(event) => updateParams({ q: event.target.value, ...resetPage })}
              placeholder="Nº, cliente, carta o concepto"
            />
          </label>
          <label>
            Desde
            <input
              type="date"
              value={from}
              onChange={(event) => updateParams({ desde: event.target.value, ...resetPage })}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={to}
              onChange={(event) => updateParams({ hasta: event.target.value, ...resetPage })}
            />
          </label>
          <label>
            Ordenar por
            <select
              value={sort}
              onChange={(event) =>
                updateParams({ orden: event.target.value as InvoiceSort, ...resetPage })
              }
            >
              <option value="date">Fecha</option>
              <option value="total">Importe</option>
              <option value="client">Cliente</option>
              <option value="status">Estado</option>
            </select>
          </label>
          {isPaymentRequests ? (
            <div className="invoice-direction-toggle">
              <Tooltip
                label={`Orden ${direction === 'desc' ? 'descendente' : 'ascendente'}. Pulsa para cambiarla.`}
              >
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label={`Cambiar a orden ${direction === 'desc' ? 'ascendente' : 'descendente'}`}
                  onClick={() =>
                    updateParams({ direccion: toggleSortDirection(direction), ...resetPage })
                  }
                >
                  {direction === 'desc' ? (
                    <ArrowDownWideNarrow size={16} aria-hidden="true" />
                  ) : (
                    <ArrowUpWideNarrow size={16} aria-hidden="true" />
                  )}
                </Button>
              </Tooltip>
            </div>
          ) : (
            <label>
              Dirección
              <select
                value={direction}
                onChange={(event) =>
                  updateParams({ direccion: event.target.value as SortDirection, ...resetPage })
                }
              >
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </label>
          )}
        </div>
      </section>

      <div className="invoice-results" aria-live="polite">
        {loading
          ? 'Actualizando resultados…'
          : `${result.total} ${result.total === 1 ? 'resultado' : 'resultados'}`}
      </div>
      <div className="invoices-list">
        {result.items.length ? (
          result.items.map((invoice) => {
            const clientName = invoice.clientName || 'Cliente'
            return (
              <BillingDocumentCard
                key={invoice.id}
                invoice={invoice}
                mode={mode}
                clientName={clientName}
                transportista={transportista}
                downloading={downloadingId === invoice.id}
                onPreview={() => updateParams({ factura: invoice.id }, false)}
                onDownload={() => void downloadDocument(invoice, clientName)}
                onManualPayment={
                  isPaymentRequests ? () => updateParams({ cobro: invoice.id }, false) : undefined
                }
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
                <h3>{copy.emptyTitle}</h3>
                <p>{error || copy.emptyDescription}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      {result.total > 0 && (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          ariaLabel={`Paginación de ${copy.title.toLowerCase()}`}
          onPageChange={updatePage}
          summary={`Mostrando ${firstRecord}–${lastRecord} de ${result.total}`}
        />
      )}
      {previewing?.issuedInvoice ? (
        <InvoicePreviewDialog
          invoice={previewing.issuedInvoice}
          onClose={() => updateParams({ factura: undefined })}
        />
      ) : (
        previewing && (
          <PaymentRequestPreviewDialog
            invoice={previewing}
            clientName={previewing.clientName || 'Cliente'}
            onClose={() => updateParams({ factura: undefined })}
          />
        )
      )}
      {isPaymentRequests && manualPayment && onConfirmManualPayment && (
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

function findByParam(invoices: ClientInvoice[], id: string | null) {
  return invoices.find((invoice) => invoice.id === id) ?? null
}
