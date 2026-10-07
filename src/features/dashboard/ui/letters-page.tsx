import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuItem,
  IconButton,
  Pagination,
} from '@doscientos/ui'
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  FileDown,
  FilePenLine,
  MoreHorizontal,
  PawPrint,
  ReceiptText,
  Search,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
  carriageLetterFileName,
  createCarriageLetterPdf,
  letterToCarriageLetter,
} from '@/features/client-portal'
import { paginate } from '@/shared/lib/pagination'
import { readEnumParam, readPageParam } from '@/shared/lib/search-params'
import type { Letter } from '@/shared/types'
import { PageIntro } from '@/shared/ui/page-intro'
import { Stat } from '@/shared/ui/stat'
import { StatusBadge } from '@/shared/ui/status-badge'
import { useUrlParams } from '@/shared/ui/use-url-params'
import { WhatsAppLink } from '@/shared/ui/whatsapp-link'

import { groupLettersByRoute } from '../application/letter-route-groups'
import { downloadBlob } from './billing-document-export'

type Props = {
  letters: Letter[]
  loading: boolean
  error: string
  onRetry: () => void
  onEdit: (letter: Letter) => void
  onOpenClient: (clientName: string) => void
  onOpenPaymentRequests: (letterId: string) => void
}

const accompanyingDocumentLabels = {
  cartilla_sanitaria: 'Cartilla sanitaria',
  microchip: 'Microchip',
  pasaporte: 'Pasaporte',
  tatuaje: 'Tatuaje',
  anillo: 'Anillo',
  cites: 'CITES',
  otro: 'Otro documento',
} satisfies Record<Letter['accompanyingDocuments'][number], string>

const billingPayerLabels = {
  remitente: 'Remitente',
  destinatario: 'Destinatario',
  manual: 'Empresa u otro',
} satisfies Record<Letter['billingPayer'], string>

const animalSizeLabels = {
  pequeno: 'Pequeño',
  mediano: 'Mediano',
  grande: 'Grande',
} as const

const letterStatusFilters = ['todos', 'pendiente', 'revisada', 'en_ruta', 'entregada'] as const
const routeGroupPageSize = 12

function formatServiceDate(serviceDate: string) {
  return new Date(`${serviceDate}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatServiceMonth(serviceMonth: string) {
  return new Date(`${serviceMonth}-01T12:00:00`).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  })
}

export function LettersPage({
  letters: sourceLetters,
  loading,
  error,
  onRetry,
  onEdit,
  onOpenClient,
  onOpenPaymentRequests,
}: Props) {
  const pageSize = 8
  const { searchParams, updateParams } = useUrlParams()
  const search = searchParams.get('q') ?? ''
  const statusFilter = readEnumParam(searchParams.get('estado'), letterStatusFilters, 'todos')
  const requestedPage = readPageParam(searchParams.get('pagina'))
  const routeGroups = useMemo(() => groupLettersByRoute(sourceLetters), [sourceLetters])
  const routeSearch = searchParams.get('ruta-busqueda') ?? ''
  const routeTemplateFilter = searchParams.get('ruta-plantilla') ?? ''
  const routeMonthFilter = searchParams.get('ruta-mes') ?? ''
  const requestedRoutePage = readPageParam(searchParams.get('pagina-rutas'))
  const routeTemplateOptions = useMemo(
    () =>
      [...new Set(routeGroups.map(({ routeName }) => routeName))].toSorted((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    [routeGroups],
  )
  const routeMonthOptions = useMemo(
    () =>
      [...new Set(routeGroups.map(({ serviceDate }) => serviceDate.slice(0, 7)))].toSorted((a, b) =>
        b.localeCompare(a),
      ),
    [routeGroups],
  )
  const filteredRouteGroups = useMemo(() => {
    const term = routeSearch.trim().toLocaleLowerCase()
    return routeGroups.filter((group) => {
      const matchesSearch =
        !term ||
        [group.routeName, group.serviceDate, formatServiceDate(group.serviceDate)]
          .join(' ')
          .toLocaleLowerCase()
          .includes(term)
      const matchesTemplate = !routeTemplateFilter || group.routeName === routeTemplateFilter
      const matchesMonth = !routeMonthFilter || group.serviceDate.startsWith(routeMonthFilter)
      return matchesSearch && matchesTemplate && matchesMonth
    })
  }, [routeGroups, routeMonthFilter, routeSearch, routeTemplateFilter])
  const routeGroupPagination = paginate(filteredRouteGroups, requestedRoutePage, routeGroupPageSize)
  const viewingLetter =
    sourceLetters.find((letter) => letter.id === searchParams.get('carta')) ?? null
  const selectedRouteGroup =
    routeGroups.find((group) => group.key === searchParams.get('ruta-carta')) ??
    routeGroups.find((group) => group.letters.some((letter) => letter.id === viewingLetter?.id))
  const searchedLetters = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    const routeLetters = selectedRouteGroup?.letters ?? []
    if (!term) return routeLetters
    return routeLetters.filter((letter) =>
      [
        letter.id,
        letter.sender,
        letter.senderPhone,
        letter.recipient,
        letter.recipientPhone,
        letter.origin,
        letter.destination,
        letter.route,
        letter.serviceDate,
        letter.status,
        ...letter.animals.map((animal) => animal.breed),
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(term),
    )
  }, [search, selectedRouteGroup])
  const letters = useMemo(
    () =>
      statusFilter === 'todos'
        ? searchedLetters
        : searchedLetters.filter((letter) => letter.status === statusFilter),
    [searchedLetters, statusFilter],
  )
  const summary = useMemo(
    () =>
      letters.reduce(
        (totals, letter) => ({
          pending: totals.pending + Number(letter.status === 'pendiente'),
          scheduled: totals.scheduled + Number(letter.status !== 'pendiente'),
          animals: totals.animals + letter.animals.length,
        }),
        { pending: 0, scheduled: 0, animals: 0 },
      ),
    [letters],
  )
  const letterPagination = paginate(letters, requestedPage, pageSize)
  const [downloadError, setDownloadError] = useState('')

  async function downloadLetterPdf(letter: Letter) {
    setDownloadError('')
    try {
      const document = letterToCarriageLetter(letter)
      downloadBlob(await createCarriageLetterPdf(document), carriageLetterFileName(document))
    } catch {
      setDownloadError('No se ha podido generar el PDF de la carta de porte.')
    }
  }

  useEffect(() => {
    if (requestedPage > letterPagination.pageCount) {
      updateParams({
        pagina: letterPagination.pageCount === 1 ? undefined : letterPagination.pageCount,
      })
    }
  }, [letterPagination.pageCount, requestedPage, updateParams])

  useEffect(() => {
    if (requestedRoutePage > routeGroupPagination.pageCount) {
      updateParams({
        'pagina-rutas':
          routeGroupPagination.pageCount === 1 ? undefined : routeGroupPagination.pageCount,
      })
    }
  }, [requestedRoutePage, routeGroupPagination.pageCount, updateParams])

  return (
    <>
      <PageIntro
        text={
          selectedRouteGroup
            ? `Cartas de porte de ${selectedRouteGroup.routeName}.`
            : 'Selecciona una ruta para consultar sus cartas de porte.'
        }
      />
      {selectedRouteGroup ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                updateParams({
                  'ruta-carta': undefined,
                  q: undefined,
                  estado: undefined,
                  pagina: undefined,
                  carta: undefined,
                })
              }
            >
              <ArrowLeft size={16} /> Todas las rutas
            </Button>
            <div>
              <h2 className="text-base font-semibold">{selectedRouteGroup.routeName}</h2>
              <p className="text-muted-foreground text-sm">
                {formatServiceDate(selectedRouteGroup.serviceDate)} ·{' '}
                {selectedRouteGroup.letters.length}{' '}
                {selectedRouteGroup.letters.length === 1 ? 'carta de porte' : 'cartas de porte'}
              </p>
            </div>
          </div>
          <section className="mb-5 grid grid-cols-3 gap-3.5 max-[850px]:grid-cols-1 max-[850px]:gap-[9px]">
            <Stat
              label="Necesita revisión"
              value={summary.pending}
              accent="lime"
              loading={loading}
              successWhenZero
              compact
            />
            <Stat
              label="Programadas (semana)"
              value={summary.scheduled}
              loading={loading}
              compact
            />
            <Stat label="En transporte" value={summary.animals} loading={loading} compact />
          </section>
          <Card className="table-card">
            <CardContent>
              <div className="table-heading">
                <div>
                  <h3>Cartas de porte</h3>
                  <p>{loading ? 'Cargando registros…' : `${letters.length} registros`}</p>
                </div>
                <div className="table-controls">
                  <label className="search">
                    <Search size={17} />
                    <input
                      value={search}
                      onChange={(event) =>
                        updateParams({ q: event.target.value, pagina: undefined })
                      }
                      placeholder="Buscar"
                      aria-label="Buscar cartas"
                      disabled={loading}
                    />
                  </label>
                  <label className="status-filter" htmlFor="letters-status-filter">
                    <span>Estado</span>
                    <select
                      id="letters-status-filter"
                      value={statusFilter}
                      onChange={(event) =>
                        updateParams({
                          estado: event.target.value === 'todos' ? undefined : event.target.value,
                          pagina: undefined,
                        })
                      }
                      aria-label="Filtrar cartas por estado"
                      disabled={loading}
                    >
                      <option value="todos">Todos</option>
                      <option value="pendiente">Pendientes</option>
                      <option value="revisada">Revisadas</option>
                      <option value="en_ruta">En ruta</option>
                      <option value="entregada">Entregadas</option>
                    </select>
                  </label>
                </div>
              </div>
              {downloadError && (
                <p className="letter-load-error" role="alert">
                  {downloadError}
                </p>
              )}
              {loading ? (
                <LettersListSkeleton />
              ) : error ? (
                <div className="letter-load-error" role="alert">
                  <p>{error}</p>
                  <Button size="sm" variant="outline" onClick={onRetry}>
                    Reintentar
                  </Button>
                </div>
              ) : letters.length === 0 ? (
                <p className="empty-copy">No hay cartas que coincidan con los filtros.</p>
              ) : (
                <>
                  <div className="responsive-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Referencia</th>
                          <th>Trayecto</th>
                          <th>Mascotas</th>
                          <th>Fecha</th>
                          <th>Estado</th>
                          <th aria-label="Acciones" />
                        </tr>
                      </thead>
                      <tbody>
                        {letterPagination.items.map((letter) => (
                          <LetterRow
                            key={letter.id}
                            letter={letter}
                            onView={(letter) => updateParams({ carta: letter.id }, false)}
                            onEdit={onEdit}
                            onDownload={(letter) => void downloadLetterPdf(letter)}
                            clientName={letter.billingClient.fullName}
                            onOpenClient={onOpenClient}
                            onOpenPaymentRequests={onOpenPaymentRequests}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="letter-cards">
                    {letterPagination.items.map((letter) => (
                      <LetterCard
                        key={letter.id}
                        letter={letter}
                        onView={(letter) => updateParams({ carta: letter.id }, false)}
                        onEdit={onEdit}
                        onDownload={(letter) => void downloadLetterPdf(letter)}
                        clientName={letter.billingClient.fullName}
                        onOpenClient={onOpenClient}
                        onOpenPaymentRequests={onOpenPaymentRequests}
                      />
                    ))}
                  </div>
                  <Pagination
                    page={letterPagination.page}
                    pageCount={letterPagination.pageCount}
                    ariaLabel="Paginación de cartas"
                    onPageChange={(nextPage) =>
                      updateParams({ pagina: nextPage === 1 ? undefined : nextPage })
                    }
                    summary={`Mostrando ${letterPagination.firstRecord}–${letterPagination.lastRecord} de ${letters.length}`}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {!loading && !error && routeGroups.length > 0 && (
            <section
              className="mb-4 flex flex-wrap items-center gap-2.5"
              role="search"
              aria-label="Filtros de rutas"
            >
              <label className="search" htmlFor="letters-route-search">
                <Search size={17} aria-hidden="true" />
                <input
                  id="letters-route-search"
                  aria-label="Buscar rutas por nombre o fecha"
                  placeholder="Buscar ruta o fecha"
                  value={routeSearch}
                  onChange={(event) =>
                    updateParams({
                      'ruta-busqueda': event.target.value,
                      'pagina-rutas': undefined,
                    })
                  }
                />
              </label>
              <label className="route-status-filter" htmlFor="letters-route-template-filter">
                <span>Plantilla</span>
                <select
                  id="letters-route-template-filter"
                  aria-label="Filtrar rutas por plantilla"
                  value={routeTemplateFilter}
                  onChange={(event) =>
                    updateParams({
                      'ruta-plantilla': event.target.value,
                      'pagina-rutas': undefined,
                    })
                  }
                >
                  <option value="">Todas</option>
                  {routeTemplateOptions.map((routeName) => (
                    <option key={routeName} value={routeName}>
                      {routeName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="route-status-filter" htmlFor="letters-route-month-filter">
                <span>Mes</span>
                <select
                  id="letters-route-month-filter"
                  aria-label="Filtrar rutas por mes"
                  value={routeMonthFilter}
                  onChange={(event) =>
                    updateParams({ 'ruta-mes': event.target.value, 'pagina-rutas': undefined })
                  }
                >
                  <option value="">Todos</option>
                  {routeMonthOptions.map((month) => (
                    <option key={month} value={month}>
                      {formatServiceMonth(month)}
                    </option>
                  ))}
                </select>
              </label>
              {(routeSearch || routeTemplateFilter || routeMonthFilter) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateParams({
                      'ruta-busqueda': undefined,
                      'ruta-plantilla': undefined,
                      'ruta-mes': undefined,
                      'pagina-rutas': undefined,
                    })
                  }
                >
                  Limpiar filtros
                </Button>
              )}
            </section>
          )}
          {loading ? (
            <LettersListSkeleton />
          ) : error ? (
            <div className="letter-load-error" role="alert">
              <p>{error}</p>
              <Button size="sm" variant="outline" onClick={onRetry}>
                Reintentar
              </Button>
            </div>
          ) : filteredRouteGroups.length === 0 ? (
            <p className="empty-copy">
              {routeGroups.length === 0
                ? 'Todavía no hay cartas de porte.'
                : 'No hay rutas que coincidan con los filtros.'}
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {routeGroupPagination.items.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    className="flex min-h-20 w-full items-start gap-4 rounded-xl border border-[#e6e0e0] bg-white p-4 text-left transition hover:border-[#dfbcbf] hover:bg-[#fffafa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c7202a]"
                    aria-label={`Ver ${group.letters.length} cartas de ${group.routeName}, ${formatServiceDate(group.serviceDate)}`}
                    onClick={() =>
                      updateParams({
                        'ruta-carta': group.key,
                        q: undefined,
                        estado: undefined,
                        pagina: undefined,
                        carta: undefined,
                      })
                    }
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="bg-muted-foreground/35 mt-1 size-3 shrink-0 rounded-full"
                        style={
                          group.templateColor ? { backgroundColor: group.templateColor } : undefined
                        }
                      />
                      <span className="grid gap-1 text-left">
                        <strong className="text-sm font-semibold">{group.routeName}</strong>
                        <span className="text-muted-foreground text-sm">
                          {formatServiceDate(group.serviceDate)}
                        </span>
                        <small className="text-muted-foreground text-xs">
                          {group.letters.length}{' '}
                          {group.letters.length === 1 ? 'carta de porte' : 'cartas de porte'}
                        </small>
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="ml-auto self-center" size={18} />
                  </button>
                ))}
              </div>
              <Pagination
                page={routeGroupPagination.page}
                pageCount={routeGroupPagination.pageCount}
                ariaLabel="Paginación de rutas con cartas"
                onPageChange={(nextPage) =>
                  updateParams({ 'pagina-rutas': nextPage === 1 ? undefined : nextPage })
                }
                summary={`Mostrando ${routeGroupPagination.firstRecord}–${routeGroupPagination.lastRecord} de ${filteredRouteGroups.length} rutas`}
              />
            </>
          )}
        </>
      )}
      {viewingLetter && (
        <LetterDetailsDialog
          letter={viewingLetter}
          clientName={viewingLetter.billingClient.fullName}
          onDownload={(letter) => void downloadLetterPdf(letter)}
          onClose={() => updateParams({ carta: undefined })}
          onOpenClient={onOpenClient}
          onOpenPaymentRequests={onOpenPaymentRequests}
        />
      )}
    </>
  )
}

function LettersListSkeleton() {
  return (
    <div className="letters-list-skeleton" aria-busy="true" aria-label="Cargando cartas de porte">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="letters-list-skeleton-row" key={index}>
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}

function LetterRow({
  letter,
  onView,
  onEdit,
  onDownload,
  clientName,
  onOpenClient,
  onOpenPaymentRequests,
}: {
  letter: Letter
  onView: (letter: Letter) => void
  onEdit: (letter: Letter) => void
  onDownload: (letter: Letter) => void
  clientName: string
  onOpenClient: (clientName: string) => void
  onOpenPaymentRequests: (letterId: string) => void
}) {
  return (
    <tr>
      <td>
        <strong>{letter.id}</strong>
        <small>Creada {letter.importedAt}</small>
      </td>
      <td>
        <span className="route-cell">
          <b>{letter.origin}</b>
          <ChevronRight size={14} />
          <b>{letter.destination}</b>
        </span>
        <small>{letter.route}</small>
      </td>
      <td>
        <span className="pet-list">
          <PawPrint size={15} /> {letter.animals.map((animal) => animal.breed).join(', ')}
        </span>
        <small>
          {letter.animals.length} animal{letter.animals.length !== 1 && 'es'}
        </small>
      </td>
      <td>
        {new Date(`${letter.serviceDate}T12:00:00`).toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short',
        })}
      </td>
      <td>
        <StatusBadge status={letter.status} />
      </td>
      <td>
        <div className="row-actions">
          <IconButton type="button" label="Ver detalles" onClick={() => onView(letter)}>
            <Eye size={17} />
          </IconButton>
          <LetterActionsMenu
            letter={letter}
            clientName={clientName}
            onEdit={onEdit}
            onDownload={onDownload}
            onOpenClient={onOpenClient}
            onOpenPaymentRequests={onOpenPaymentRequests}
          />
        </div>
      </td>
    </tr>
  )
}

function LetterActionsMenu({
  letter,
  clientName,
  onEdit,
  onDownload,
  onOpenClient,
  onOpenPaymentRequests,
}: {
  letter: Letter
  clientName: string
  onEdit: (letter: Letter) => void
  onDownload: (letter: Letter) => void
  onOpenClient: (clientName: string) => void
  onOpenPaymentRequests: (letterId: string) => void
}) {
  return (
    <DropdownMenu
      trigger={
        <Button
          className="letter-row-menu-trigger"
          variant="outline"
          size="icon"
          aria-label={`Más acciones de ${letter.id}`}
        >
          <MoreHorizontal size={17} />
        </Button>
      }
      placement="bottom end"
      className="min-w-48"
    >
      <DropdownMenuItem onAction={() => onEdit(letter)}>
        <FilePenLine size={16} /> Editar carta
      </DropdownMenuItem>
      <DropdownMenuItem onAction={() => onDownload(letter)}>
        <FileDown size={16} /> Descargar PDF
      </DropdownMenuItem>
      <DropdownMenuItem onAction={() => onOpenPaymentRequests(letter.id)}>
        <ReceiptText size={16} /> Ver solicitud de pago
      </DropdownMenuItem>
      {clientName && (
        <DropdownMenuItem onAction={() => onOpenClient(clientName)}>
          <UserRound size={16} /> Buscar cliente
        </DropdownMenuItem>
      )}
    </DropdownMenu>
  )
}

function LetterCard({
  letter,
  onView,
  onEdit,
  onDownload,
  clientName,
  onOpenClient,
  onOpenPaymentRequests,
}: {
  letter: Letter
  onView: (letter: Letter) => void
  onEdit: (letter: Letter) => void
  onDownload: (letter: Letter) => void
  clientName: string
  onOpenClient: (clientName: string) => void
  onOpenPaymentRequests: (letterId: string) => void
}) {
  return (
    <article className="letter-card">
      <div className="letter-card-heading">
        <div>
          <strong>{letter.id}</strong>
          <small>Creada {letter.importedAt}</small>
        </div>
        <StatusBadge status={letter.status} />
      </div>
      <div className="letter-card-route">
        <span>{letter.origin}</span>
        <ChevronRight size={15} />
        <span>{letter.destination}</span>
      </div>
      <div className="letter-card-meta">
        <span>
          <PawPrint size={15} /> {letter.animals.length} animal{letter.animals.length !== 1 && 'es'}
        </span>
        <span>
          {new Date(`${letter.serviceDate}T12:00:00`).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
          })}
        </span>
      </div>
      <div className="letter-card-footer">
        <span>{letter.route}</span>
        <div>
          <button className="letter-card-view-button" type="button" onClick={() => onView(letter)}>
            <Eye size={16} /> Ver detalles
          </button>
          <LetterActionsMenu
            letter={letter}
            clientName={clientName}
            onEdit={onEdit}
            onDownload={onDownload}
            onOpenClient={onOpenClient}
            onOpenPaymentRequests={onOpenPaymentRequests}
          />
        </div>
      </div>
    </article>
  )
}

function LetterDetailsDialog({
  letter,
  clientName,
  onDownload,
  onClose,
  onOpenClient,
  onOpenPaymentRequests,
}: {
  letter: Letter
  clientName: string
  onDownload: (letter: Letter) => void
  onClose: () => void
  onOpenClient: (clientName: string) => void
  onOpenPaymentRequests: (letterId: string) => void
}) {
  const senderAddress = [letter.senderAddress, letter.senderPostalCode, letter.senderCity]
    .filter(Boolean)
    .join(', ')
  const recipientAddress = [
    letter.recipientAddress,
    letter.recipientPostalCode,
    letter.recipientCity,
  ]
    .filter(Boolean)
    .join(', ')
  const contactMessage = (name: string) =>
    [
      `Hola${name ? ` ${name}` : ''}, te escribimos de Kache Envíos sobre el transporte ${letter.origin} → ${letter.destination} del ${formatServiceDate(letter.serviceDate)}.`,
      letter.route ? `Ruta: ${letter.route}.` : '',
    ]
      .filter(Boolean)
      .join(' ')

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="dialog-card letter-details-dialog">
        <DialogHeader className="gap-0">
          <DialogTitle>{letter.id}</DialogTitle>
          <DialogDescription>
            Detalle de la carta de porte y del servicio contratado.
          </DialogDescription>
        </DialogHeader>
        <div className="letter-detail-route" aria-label="Trayecto">
          <span>{letter.origin}</span>
          <ChevronRight aria-hidden size={18} />
          <span>{letter.destination}</span>
        </div>
        <dl className="letter-detail-summary">
          <div>
            <dt>Servicio</dt>
            <dd>{formatServiceDate(letter.serviceDate)}</dd>
          </div>
          <div>
            <dt>Ruta</dt>
            <dd>{letter.route || 'Sin ruta asignada'}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              <StatusBadge status={letter.status} />
            </dd>
          </div>
        </dl>
        <section className="letter-detail-section">
          <h3>Contacto y entrega</h3>
          <div className="letter-detail-contacts">
            <ContactDetails
              title="Remitente"
              name={letter.sender}
              phone={letter.senderPhone}
              email={letter.senderEmail}
              address={senderAddress}
              message={contactMessage(letter.sender)}
            />
            <ContactDetails
              title="Destinatario"
              name={letter.recipient}
              phone={letter.recipientPhone}
              email={letter.recipientEmail}
              address={recipientAddress}
              message={contactMessage(letter.recipient)}
            />
          </div>
        </section>
        <section className="letter-detail-section">
          <h3>Mascotas</h3>
          <div className="letter-detail-animals">
            {letter.animals.map((animal, index) => (
              <article key={animal.id}>
                <PawPrint size={17} />
                <div>
                  <strong>{animal.breed || animal.species || `Mascota ${index + 1}`}</strong>
                  <span>
                    {animal.species || 'Especie sin indicar'} · {animalSizeLabels[animal.size]}
                    {animal.box ? ` · Box ${animal.box}` : ''}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="letter-detail-section letter-detail-meta">
          <div>
            <h3>Documentación</h3>
            <p>
              {letter.accompanyingDocuments.length
                ? letter.accompanyingDocuments
                    .map((document) => accompanyingDocumentLabels[document])
                    .join(', ')
                : 'Sin documentos indicados'}
            </p>
          </div>
          <div>
            <h3>Facturación</h3>
            <p>{billingPayerLabels[letter.billingPayer]}</p>
          </div>
          <div>
            <h3>Firma</h3>
            <p>{letter.signedAt ? `Firmada el ${letter.signedAt}` : 'Pendiente de firma'}</p>
          </div>
        </section>
        <div className="invoice-card-actions">
          <Button size="sm" variant="outline" onClick={() => onDownload(letter)}>
            <FileDown size={15} /> Descargar PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => onOpenPaymentRequests(letter.id)}>
            <ReceiptText size={15} /> Ver solicitud
          </Button>
          {clientName && (
            <Button size="sm" variant="outline" onClick={() => onOpenClient(clientName)}>
              <UserRound size={15} /> Ver cliente
            </Button>
          )}
        </div>
        <Button className="dialog-submit" variant="outline" onClick={onClose}>
          Cerrar detalle
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function ContactDetails({
  title,
  name,
  phone,
  email,
  address,
  message,
}: {
  title: string
  name: string
  phone: string
  email: string
  address: string
  message: string
}) {
  return (
    <article>
      <h4>{title}</h4>
      <strong>{name || 'Sin nombre indicado'}</strong>
      <span>{phone || 'Sin teléfono'}</span>
      <WhatsAppLink phone={phone} message={message} recipient={name || title} />
      <span>{email || 'Sin email'}</span>
      <span>{address || 'Sin dirección'}</span>
    </article>
  )
}
