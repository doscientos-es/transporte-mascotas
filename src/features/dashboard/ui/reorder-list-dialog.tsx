import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@doscientos/ui'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import {
  type KeyboardEvent,
  type PointerEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { keyboardInsertionIndex, moveItemAtInsertionIndex } from '../application/stop-order'

export type ReorderItem = { id: string; title: string; description: string }

/** Shared by route stops and the pickup/delivery cards within a stop. */
export function ReorderList({
  items,
  busy = false,
  onChange,
}: {
  items: ReorderItem[]
  busy?: boolean
  onChange: (items: ReorderItem[]) => void
}) {
  const instructionsId = useId()
  const listRef = useRef<HTMLOListElement>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const drag = useRef<{ pointerId: number; itemId: string; destination: number | null } | null>(
    null,
  )
  const focusAfterMove = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    focusAfterMove.current?.focus()
    focusAfterMove.current = null
  }, [items])

  function move(source: number, destination: number) {
    if (busy || source < 0 || source >= items.length) return
    const next = moveItemAtInsertionIndex(items, source, destination)
    const position = next.findIndex((item) => item.id === items[source].id)
    if (source === position) return
    focusAfterMove.current = listRef.current?.contains(document.activeElement)
      ? (document.activeElement as HTMLElement)
      : null
    onChange(next)
    setAnnouncement(`${items[source].title}, posición ${position + 1} de ${items.length}.`)
  }

  function moveOne(index: number, direction: 'up' | 'down') {
    const destination = keyboardInsertionIndex(index, direction, items.length)
    if (destination !== null) move(index, destination)
  }

  function resetDrag() {
    drag.current = null
    setDraggedId(null)
    setDropIndex(null)
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'Escape' && drag.current) {
      event.preventDefault()
      event.stopPropagation()
      resetDrag()
      setAnnouncement('Movimiento cancelado. Se conserva la posición anterior.')
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      if (!drag.current) moveOne(index, event.key === 'ArrowUp' ? 'up' : 'down')
    }
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, itemId: string) {
    if (busy || event.button !== 0 || drag.current) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, itemId, destination: null }
    setDraggedId(itemId)
  }

  function dragOver(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current
    if (active?.pointerId !== event.pointerId || busy) return
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-reorder-index]')
    if (!target || !listRef.current?.contains(target)) {
      active.destination = null
      setDropIndex(null)
      return
    }
    const { top, height } = target.getBoundingClientRect()
    active.destination =
      Number(target.dataset.reorderIndex) + Number(event.clientY > top + height / 2)
    setDropIndex(active.destination)
    const bounds = listRef.current.getBoundingClientRect()
    if (event.clientY < bounds.top + 32) listRef.current.scrollTop -= 16
    if (event.clientY > bounds.bottom - 32) listRef.current.scrollTop += 16
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const active = drag.current
    if (active?.pointerId !== event.pointerId) return
    if (!cancelled && active.destination !== null) {
      move(
        items.findIndex((item) => item.id === active.itemId),
        active.destination,
      )
    }
    resetDrag()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <>
      <p id={instructionsId} className="reorder-instructions">
        Arrastra para reordenar, usa las flechas del teclado sobre el control de movimiento o los
        botones Subir y Bajar. Los cambios se aplican al guardar.
      </p>
      <output className="reorder-drop-hint" aria-live="polite" aria-atomic="true">
        {dropIndex === null
          ? announcement
          : dropIndex >= items.length
            ? 'Se colocará al final de la lista.'
            : `Se colocará antes de ${items[dropIndex].title}.`}
      </output>
      <ol
        className="reorder-stops-list"
        ref={listRef}
        aria-label="Orden de los elementos"
        aria-busy={busy}
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            data-reorder-index={index}
            className={[
              draggedId === item.id ? 'is-dragging' : '',
              dropIndex === index ? 'is-drop-before' : '',
              dropIndex === items.length && index === items.length - 1 ? 'is-drop-after' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="reorder-item-row">
              <button
                type="button"
                className="reorder-stop-item"
                aria-label={`Mover ${item.title}, posición ${index + 1} de ${items.length}`}
                aria-describedby={instructionsId}
                aria-keyshortcuts="ArrowUp ArrowDown"
                aria-disabled={busy}
                onKeyDown={(event) => keyDown(event, index)}
                onPointerDown={(event) => startDrag(event, item.id)}
                onPointerMove={dragOver}
                onPointerUp={(event) => finishDrag(event)}
                onPointerCancel={(event) => finishDrag(event, true)}
                onLostPointerCapture={resetDrag}
              >
                <span className="reorder-stop-index" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="reorder-stop-description">
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
                <GripVertical size={18} className="reorder-stop-grip" aria-hidden="true" />
              </button>
              <div className="reorder-item-buttons">
                <button
                  type="button"
                  aria-label={`Subir ${item.title}`}
                  aria-disabled={busy || index === 0}
                  onClick={() => moveOne(index, 'up')}
                >
                  <ArrowUp size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Bajar ${item.title}`}
                  aria-disabled={busy || index === items.length - 1}
                  onClick={() => moveOne(index, 'down')}
                >
                  <ArrowDown size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}

export function ReorderListDialog({
  title,
  description,
  items,
  onClose,
  onSave,
}: {
  title: string
  description: string
  items: ReorderItem[]
  onClose: () => void
  onSave: (ids: string[]) => Promise<void>
}) {
  const [ordered, setOrdered] = useState(items)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const unchanged = ordered.every((item, index) => item.id === items[index]?.id)

  async function save() {
    if (saving || unchanged) return
    setSaving(true)
    setError('')
    try {
      await onSave(ordered.map((item) => item.id))
      onClose()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se ha podido guardar el orden. Inténtalo de nuevo.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose()
      }}
    >
      <DialogContent className="dialog-card route-create-dialog reorder-stops-dialog w-[calc(100%-2.5rem)]! max-w-115! p-6.5!">
        <DialogHeader className="gap-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ReorderList items={ordered} onChange={setOrdered} busy={saving} />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="reorder-stops-footer">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || unchanged}>
            {saving ? 'Guardando…' : 'Guardar orden'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
