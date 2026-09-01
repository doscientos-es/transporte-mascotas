import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  IconButton,
  Pagination,
} from '@doscientos/ui'
import {
  ChevronRight,
  Eye,
  FilePenLine,
  FilePlus2,
  HandCoins,
  PawPrint,
  ReceiptText,
  Search,
  UserRound,
} from 'lucide-react'
import { useMemo } from 'react'

import { readEnumParam, readPageParam } from '@/shared/lib/search-params'
import { statusLabels } from '@/shared/lib/status-labels'
import type { Letter } from '@/shared/types'
import { PageIntro } from '@/shared/ui/page-intro'
import { Stat } from '@/shared/ui/stat'
import { useUrlParams } from '@/shared/ui/use-url-params'

type Props = {
  letters: Letter[]
  onImport: () => void
  onEdit: (letter: Letter) => void
  onInvoice: (letter: Letter) => void
  onOpenClient: (clientName: string) => void
  onOpenInvoices: (letterId: string) => void
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

function formatServiceDate(serviceDate: string) {
  return new Date(`${serviceDate}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function LettersPage({
  letters: sourceLetters,
  onImport,
  onEdit,
  onInvoice,
  onOpenClient,
  onOpenInvoices,
}: Props) {
  const pageSize = 8
  const { searchParams, updateParams } = useUrlParams()
  const search = searchParams.get('q') ?? ''
  const statusFilter = readEnumParam(searchParams.get('estado'), letterStatusFilters, 'todos')
  const requestedPage = readPageParam(searchParams.get('pagina'))
  const viewingLetter =
    sourceLetters.find((letter) => letter.id === searchParams.get('carta')) ?? null
  const searchedLetters = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    if (!term) return sourceLetters
    return sourceLetters.filter((letter) =>
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
  }, [search, sourceLetters])
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
  const pageCount = Math.max(1, Math.ceil(letters.length / pageSize))
  const page = Math.min(requestedPage, pageCount)
  const visibleLetters = letters.slice((page - 1) * pageSize, page * pageSize)
  const firstRecord = letters.length === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRecord = Math.min(page * pageSize, letters.length)

  return (
    <>
      <PageIntro text="Crea y prepara los servicios para cada ruta.">
        <Button onClick={onImport}>
          <FilePlus2 /> Nueva carta
        </Button>
      </PageIntro>
      <section className="stats-grid">
        <Stat label="Necesita revisión" value={summary.pending} accent="lime" />
        <Stat label="Programadas (semana)" value={summary.scheduled} />
        <Stat label="En transporte" value={summary.animals} />
      </section>
      <Card className="table-card">
        <CardContent>
          <div className="table-heading">
            <div>
              <h3>Cartas de porte</h3>
              <p>{letters.length} registros</p>
            </div>
            <div className="table-controls">
              <label className="search">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(event) => updateParams({ q: event.target.value, pagina: undefined })}
                  placeholder="Buscar"
                  aria-label="Buscar cartas"
                />
              </label>
              <label className="status-filter">
                <span>Estado</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    updateParams({
                      estado: event.target.value === 'todos' ? undefined : event.target.value,
                      pagina: undefined,
                    })
                  }
                  aria-label="Filtrar cartas por estado"
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
          {letters.length === 0 ? (
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
                    {visibleLetters.map((letter) => (
                      <LetterRow
                        key={letter.id}
                        letter={letter}
                        onView={(letter) => updateParams({ carta: letter.id }, false)}
                        onEdit={onEdit}
                        onInvoice={onInvoice}
                        clientName={letter.billingClient.fullName}
                        onOpenClient={onOpenClient}
                        onOpenInvoices={onOpenInvoices}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="letter-cards">
                {visibleLetters.map((letter) => (
                  <LetterCard
                    key={letter.id}
                    letter={letter}
                    onView={(letter) => updateParams({ carta: letter.id }, false)}
                    onEdit={onEdit}
                    onInvoice={onInvoice}
                    clientName={letter.billingClient.fullName}
                    onOpenClient={onOpenClient}
                    onOpenInvoices={onOpenInvoices}
                  />
                ))}
              </div>
              <Pagination
                page={page}
                pageCount={pageCount}
                ariaLabel="Paginación de cartas"
                onPageChange={(nextPage) =>
                  updateParams({ pagina: nextPage === 1 ? undefined : nextPage })
                }
                summary={`Mostrando ${firstRecord}–${lastRecord} de ${letters.length}`}
              />
            </>
          )}
        </CardContent>
      </Card>
      {viewingLetter && (
        <LetterDetailsDialog
          letter={viewingLetter}
          clientName={viewingLetter.billingClient.fullName}
          onClose={() => updateParams({ carta: undefined })}
          onOpenClient={onOpenClient}
          onOpenInvoices={onOpenInvoices}
        />
      )}
    </>
  )
}

function LetterRow({
  letter,
  onView,
  onEdit,
  onInvoice,
  clientName,
  onOpenClient,
  onOpenInvoices,
}: {
  letter: Letter
  onView: (letter: Letter) => void
  onEdit: (letter: Letter) => void
  onInvoice: (letter: Letter) => void
  clientName: string
  onOpenClient: (clientName: string) => void
  onOpenInvoices: (letterId: string) => void
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
        <span className={`status status-${letter.status}`}>{statusLabels[letter.status]}</span>
      </td>
      <td>
        <div className="row-actions">
          <IconButton type="button" label="Ver detalles" onClick={() => onView(letter)}>
            <Eye size={17} />
          </IconButton>
          <IconButton type="button" label="Editar carta" onClick={() => onEdit(letter)}>
            <FilePenLine size={17} />
          </IconButton>
          <IconButton
            type="button"
            label="Crear solicitud de pago"
            onClick={() => onInvoice(letter)}
          >
            <HandCoins size={17} />
          </IconButton>
          <IconButton
            type="button"
            label="Ver facturas relacionadas"
            onClick={() => onOpenInvoices(letter.id)}
          >
            <ReceiptText size={17} />
          </IconButton>
          {clientName && (
            <IconButton
              type="button"
              label="Buscar cliente"
              onClick={() => onOpenClient(clientName)}
            >
              <UserRound size={17} />
            </IconButton>
          )}
        </div>
      </td>
    </tr>
  )
}

function LetterCard({
  letter,
  onView,
  onEdit,
  onInvoice,
  clientName,
  onOpenClient,
  onOpenInvoices,
}: {
  letter: Letter
  onView: (letter: Letter) => void
  onEdit: (letter: Letter) => void
  onInvoice: (letter: Letter) => void
  clientName: string
  onOpenClient: (clientName: string) => void
  onOpenInvoices: (letterId: string) => void
}) {
  return (
    <article className="letter-card">
      <div className="letter-card-heading">
        <div>
          <strong>{letter.id}</strong>
          <small>Creada {letter.importedAt}</small>
        </div>
        <span className={`status status-${letter.status}`}>{statusLabels[letter.status]}</span>
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
          <button type="button" onClick={() => onView(letter)}>
            <Eye size={16} /> Ver
          </button>
          <button type="button" onClick={() => onEdit(letter)}>
            <FilePenLine size={16} /> Editar
          </button>
          <button type="button" onClick={() => onInvoice(letter)}>
            <HandCoins size={16} /> Pago
          </button>
          <button type="button" onClick={() => onOpenInvoices(letter.id)}>
            <ReceiptText size={16} /> Facturas
          </button>
          {clientName && (
            <button type="button" onClick={() => onOpenClient(clientName)}>
              <UserRound size={16} /> Cliente
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function LetterDetailsDialog({
  letter,
  clientName,
  onClose,
  onOpenClient,
  onOpenInvoices,
}: {
  letter: Letter
  clientName: string
  onClose: () => void
  onOpenClient: (clientName: string) => void
  onOpenInvoices: (letterId: string) => void
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
              <span className={`status status-${letter.status}`}>
                {statusLabels[letter.status]}
              </span>
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
            />
            <ContactDetails
              title="Destinatario"
              name={letter.recipient}
              phone={letter.recipientPhone}
              email={letter.recipientEmail}
              address={recipientAddress}
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
          <Button size="sm" variant="outline" onClick={() => onOpenInvoices(letter.id)}>
            <ReceiptText size={15} /> Ver facturas
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
}: {
  title: string
  name: string
  phone: string
  email: string
  address: string
}) {
  return (
    <article>
      <h4>{title}</h4>
      <strong>{name || 'Sin nombre indicado'}</strong>
      <span>{phone || 'Sin teléfono'}</span>
      <span>{email || 'Sin email'}</span>
      <span>{address || 'Sin dirección'}</span>
    </article>
  )
}
