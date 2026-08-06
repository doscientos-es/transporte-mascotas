import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({ page, pageCount, firstRecord, lastRecord, total, ariaLabel, onChange }: {
  page: number; pageCount: number; firstRecord: number; lastRecord: number; total: number
  ariaLabel: string; onChange: (page: number) => void
}) {
  if (pageCount <= 1) return null
  const pageNumbers = [...new Set([1, page - 1, page, page + 1, pageCount].filter((number) => number >= 1 && number <= pageCount))].sort((a, b) => a - b)
  return <nav className="pagination" aria-label={ariaLabel}><p>Mostrando {firstRecord}–{lastRecord} de {total}</p><div><button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Página anterior"><ChevronLeft size={17} /></button>{pageNumbers.map((number, index) => <span className="pagination-page" key={number}>{number > pageNumbers[index - 1] + 1 && <i aria-hidden="true">…</i>}<button type="button" className={number === page ? 'is-active' : ''} onClick={() => onChange(number)} aria-current={number === page ? 'page' : undefined}>{number}</button></span>)}<button type="button" onClick={() => onChange(page + 1)} disabled={page === pageCount} aria-label="Página siguiente"><ChevronRight size={17} /></button></div></nav>
}