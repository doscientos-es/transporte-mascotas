import type { ReactNode } from 'react'

import { DEFAULT_ATES_NUMBER } from '../application/carriage-letter-defaults'

/**
 * Building blocks that make the manual carriage letter form look like the paper
 * half-sheet the admins already know (see client-portal/application/carriage-letter-layout.ts).
 * Every cell is a real <label>, so the paper look keeps its accessible names and focus ring.
 */

export const paperControl =
  'w-full min-w-0 border-0 bg-transparent p-0 text-sm text-black outline-none placeholder:text-black/55 disabled:cursor-not-allowed disabled:opacity-60'

const cellFocus = 'focus-within:ring-2 focus-within:ring-black focus-within:ring-inset'

const paperTone = {
  sender: 'bg-gradient-to-b from-[#ffeee8] to-[#f6a58c]',
  recipient: 'bg-gradient-to-b from-[#f1f1f1] to-[#c9c9c9]',
  plain: 'bg-white',
} as const

export function PaperSheet({ children }: { children: ReactNode }) {
  return <div className="border-2 border-black bg-white text-black">{children}</div>
}

export function PaperCell({
  label,
  className = '',
  tone = 'plain',
  children,
}: {
  label: string
  className?: string
  tone?: keyof typeof paperTone
  children: ReactNode
}) {
  return (
    <label
      className={`flex min-w-0 flex-col gap-0.5 border border-neutral-600 px-2 py-1 ${paperTone[tone]} ${cellFocus} ${className}`}
    >
      <span className="text-[11px] font-bold">{label}</span>
      {children}
    </label>
  )
}

/** Static cell that is not a form control (titles, notes). */
export function PaperBand({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`border border-neutral-600 px-2 py-1.5 text-center text-xs font-bold tracking-wide ${className}`}
    >
      {children}
    </div>
  )
}

export function PaperHeader({
  reference,
  referenceLocked,
  onReferenceChange,
  boxNumber,
  onBoxNumberChange,
  atesNumber,
  onAtesNumberChange,
}: {
  reference: string
  referenceLocked: boolean
  onReferenceChange: (value: string) => void
  boxNumber?: number | undefined
  onBoxNumberChange: (value: number | undefined) => void
  atesNumber: string
  onAtesNumberChange: (value: string) => void
}) {
  return (
    <header className="grid items-stretch border-b-2 border-black sm:grid-cols-[1fr_auto_1fr]">
      <div className="flex flex-col justify-center gap-1 p-3">
        <span className="text-[11px] font-bold tracking-wide">CARTA DE PORTE</span>
        <label className="flex items-baseline gap-1.5 text-sm font-bold">
          Nº
          <input
            className={`${paperControl} border-b border-neutral-500 focus-visible:border-black`}
            value={reference}
            onChange={(event) => onReferenceChange(event.target.value)}
            placeholder="Automático"
            disabled={referenceLocked}
            aria-describedby="letter-reference-hint"
          />
        </label>
        <span id="letter-reference-hint" className="text-[11px] text-neutral-700">
          {referenceLocked
            ? 'No se puede cambiar una vez creada.'
            : 'Déjalo vacío para asignarlo automáticamente.'}
        </span>
      </div>
      <div className="flex flex-col items-center justify-center gap-0.5 px-4 py-2">
        <img src="/icon-512.png" alt="Kache Envíos" className="size-20 object-contain" />
        <span className="text-[11px]">kacheenvios.com</span>
      </div>
      <div className="flex flex-col justify-center gap-1 p-3 sm:items-end sm:text-right">
        <label className="flex items-baseline gap-1.5 text-sm font-bold">
          Nº Box
          <input
            className={`${paperControl} w-20 border-b border-neutral-500 focus-visible:border-black sm:text-right`}
            type="number"
            min="1"
            inputMode="numeric"
            value={boxNumber ?? ''}
            onChange={(event) =>
              onBoxNumberChange(event.target.value ? Number(event.target.value) : undefined)
            }
            placeholder="Auto"
            aria-describedby="letter-box-hint"
          />
        </label>
        <span id="letter-box-hint" className="text-[11px] text-neutral-700">
          Vacío: se asigna un box libre automáticamente.
        </span>
        <label className="flex items-baseline gap-1.5 text-sm font-bold">
          ATES
          <input
            className={`w-44 border-b border-neutral-500 focus-visible:border-black sm:text-right`}
            value={atesNumber}
            onChange={(event) => onAtesNumberChange(event.target.value)}
            placeholder={DEFAULT_ATES_NUMBER}
          />
        </label>
      </div>
    </header>
  )
}

/** Sender / recipient block with the coloured side tab of the paper letter. */
export function PaperParty({
  role,
  title,
  hint,
  children,
}: {
  role: 'sender' | 'recipient'
  title: string
  hint: string
  children: ReactNode
}) {
  const sender = role === 'sender'
  return (
    <fieldset
      className={`m-0 flex min-w-0 border-0 p-0 max-md:flex-col ${sender ? 'md:flex-row' : 'md:flex-row-reverse'}`}
    >
      <legend className="sr-only">
        {title}. {hint}
      </legend>
      <span
        aria-hidden="true"
        className={`flex items-center justify-center border border-neutral-600 px-2 py-1 text-[11px] font-bold tracking-[0.25em] md:w-7 md:px-0 md:[writing-mode:vertical-rl] ${
          sender ? 'bg-[#f46a46] text-black md:rotate-180' : 'bg-[#6b6b6b] text-white'
        }`}
      >
        {title.toUpperCase()}
      </span>
      <div className="grid min-w-0 flex-1 grid-cols-2">{children}</div>
    </fieldset>
  )
}
