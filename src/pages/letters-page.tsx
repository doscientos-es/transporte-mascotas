import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, FilePenLine, FilePlus2, PawPrint, Printer, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PageIntro } from '../components/page-intro'
import { Pagination } from '../components/pagination'
import { Stat } from '../components/stat'
import { statusLabels } from '../lib/status-labels'
import type { Letter } from '../lib/types'

type Props = {
  letters: Letter[]
  search: string
  onSearchChange: (value: string) => void
  onImport: () => void
  onEdit: (letter: Letter) => void
  onInvoice: (letter: Letter) => void
}

export function LettersPage({
  letters: searchedLetters,
  search,
  onSearchChange,
  onImport,
  onEdit,
  onInvoice,
}: Props) {
  const pageSize = 8
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<Letter['status'] | 'todos'>('todos')
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
  const visibleLetters = letters.slice((page - 1) * pageSize, page * pageSize)
  const firstRecord = letters.length === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRecord = Math.min(page * pageSize, letters.length)
  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])
  useEffect(() => {
    setPage((current) => Math.min(current, pageCount))
  }, [pageCount])

  return (
    <>
      <PageIntro text="Crea y prepara los servicios para cada ruta.">
        <Button onClick={onImport}>
          <FilePlus2 /> Nueva carta
        </Button>
      </PageIntro>
      <section className="stats-grid">
        <Stat label="Pendientes de revisión" value={summary.pending} accent="lime" />
        <Stat label="Programadas esta semana" value={summary.scheduled} />
        <Stat label="Animales en transporte" value={summary.animals} />
      </section>
      <Card className="table-card">
        <CardContent>
          <div className="table-heading">
            <div>
              <h3>Últimas cartas</h3>
              <p>{letters.length} registros</p>
            </div>
            <div className="table-controls">
              <label className="search">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Buscar"
                  aria-label="Buscar cartas"
                />
              </label>
              <label className="status-filter">
                <span>Estado</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as Letter['status'] | 'todos')
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
                        onEdit={onEdit}
                        onInvoice={onInvoice}
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
                    onEdit={onEdit}
                    onInvoice={onInvoice}
                  />
                ))}
              </div>
              <Pagination
                page={page}
                pageCount={pageCount}
                firstRecord={firstRecord}
                lastRecord={lastRecord}
                total={letters.length}
                ariaLabel="Paginación de cartas"
                onChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function LetterRow({
  letter,
  onEdit,
  onInvoice,
}: {
  letter: Letter
  onEdit: (letter: Letter) => void
  onInvoice: (letter: Letter) => void
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
          <button
            type="button"
            title="Editar carta"
            aria-label={`Editar ${letter.id}`}
            onClick={() => onEdit(letter)}
          >
            <FilePenLine size={17} />
          </button>
          <button type="button" title="Generar factura" onClick={() => onInvoice(letter)}>
            <Printer size={17} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function LetterCard({
  letter,
  onEdit,
  onInvoice,
}: {
  letter: Letter
  onEdit: (letter: Letter) => void
  onInvoice: (letter: Letter) => void
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
          <button type="button" onClick={() => onEdit(letter)}>
            <FilePenLine size={16} /> Editar
          </button>
          <button type="button" onClick={() => onInvoice(letter)}>
            <Printer size={16} /> Facturar
          </button>
        </div>
      </div>
    </article>
  )
}
