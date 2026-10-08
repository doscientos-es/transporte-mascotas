import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@doscientos/ui'
import {
  ChevronRight,
  Clock3,
  Copy,
  GripVertical,
  LoaderCircle,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import type { RouteDirection, RouteTemplate, SavedMeetingPoint } from '@/shared/types'
import { PageIntro } from '@/shared/ui/page-intro'

import { mergedStopInstructions } from '../application/stop-instructions'
import { keyboardInsertionIndex, moveItemAtInsertionIndex } from '../application/stop-order'
import { NewTemplateDialog, StopFormDialog, type StopFormValues } from './operation-dialogs'

type StopDragState = {
  pointerId: number
  stopId: string
  startX: number
  startY: number
  destinationIndex: number | null
  isDragging: boolean
}

const noTemplateStops: RouteTemplate['stops'] = []

type Props = {
  templates: RouteTemplate[]
  meetingPoints?: SavedMeetingPoint[]
  selected: RouteTemplate | null
  createRequestId: number
  onSelect: (template: RouteTemplate) => void
  onCreate: (name: string, color: string) => Promise<void>
  onDuplicate: (templateId: string, direction?: RouteDirection) => Promise<void>
  onUpdate: (templateId: string, name: string, color: string) => Promise<void>
  onDelete: (templateId: string) => Promise<void>
  onAddStop: (templateId: string, stop: StopFormValues, insertionIndex?: number) => Promise<void>
  onUpdateStop: (templateId: string, stopId: string, stop: StopFormValues) => Promise<void>
  onDeleteStop: (templateId: string, stopId: string) => Promise<void>
  onReorderStops: (templateId: string, stops: RouteTemplate['stops']) => Promise<void>
  onRecalculateTimes: (templateId: string) => Promise<void>
}

export function TemplatesPage({
  templates,
  meetingPoints = [],
  selected,
  createRequestId,
  onSelect,
  onCreate,
  onDuplicate,
  onUpdate,
  onDelete,
  onAddStop,
  onUpdateStop,
  onDeleteStop,
  onReorderStops,
  onRecalculateTimes,
}: Props) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [addingStopAt, setAddingStopAt] = useState<number | null>(null)
  const [editingStopId, setEditingStopId] = useState<string | null>(null)
  const [stopToDelete, setStopToDelete] = useState<RouteTemplate['stops'][number] | null>(null)
  const [deletingStop, setDeletingStop] = useState(false)
  const [stopDeleteError, setStopDeleteError] = useState('')
  const [movingStopId, setMovingStopId] = useState<string | null>(null)
  const [draggingStopId, setDraggingStopId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)
  const [recalculatingTimes, setRecalculatingTimes] = useState(false)
  const [optimisticStops, setOptimisticStops] = useState<RouteTemplate['stops'] | null>(null)
  const [dragPreview, setDragPreview] = useState<{ stopId: string; x: number; y: number } | null>(
    null,
  )
  const [reorderAnnouncement, setReorderAnnouncement] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const busy = reordering || recalculatingTimes
  const displayedStops = optimisticStops ?? selected?.stops ?? noTemplateStops
  const stopListRef = useRef<HTMLOListElement>(null)
  const dragState = useRef<StopDragState | null>(null)
  const suppressClickRef = useRef(false)
  const previousStopPositions = useRef<Map<string, number> | null>(null)

  useEffect(() => {
    dragState.current = null
    suppressClickRef.current = false
    setAddingStopAt(null)
    setEditingStopId(null)
    setStopToDelete(null)
    setMovingStopId(null)
    setDraggingStopId(null)
    setDragPreview(null)
    setDropIndex(null)
    setError('')
  }, [selected?.id])

  useEffect(() => {
    setOptimisticStops(null)
  }, [selected?.id, selected?.stops])

  useLayoutEffect(() => {
    const previousPositions = previousStopPositions.current
    if (!previousPositions) return
    previousStopPositions.current = null
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    stopListRef.current
      ?.querySelectorAll<HTMLElement>('[data-template-stop-id]')
      .forEach((element) => {
        const stopId = element.dataset.templateStopId
        if (!stopId || typeof element.animate !== 'function') return
        const previousTop = previousPositions.get(stopId)
        if (previousTop === undefined) return
        const offset = previousTop - element.getBoundingClientRect().top
        if (offset === 0) return
        element.animate(
          [{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }],
          { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        )
      })
  }, [displayedStops])

  useEffect(() => {
    if (createRequestId) setCreating(true)
  }, [createRequestId])

  if (!selected)
    return (
      <>
        <PageIntro text="Crea una plantilla de ruta para empezar a organizar los transportes." />
        <Card className="stops-card">
          <CardContent>
            <p>Aún no hay plantillas de ruta.</p>
          </CardContent>
        </Card>
        {creating && <NewTemplateDialog onClose={() => setCreating(false)} onCreate={onCreate} />}
      </>
    )

  function updateDisplayedStops(stops: RouteTemplate['stops'] | null) {
    const positions = new Map<string, number>()
    stopListRef.current
      ?.querySelectorAll<HTMLElement>('[data-template-stop-id]')
      .forEach((element) => {
        const stopId = element.dataset.templateStopId
        if (stopId) positions.set(stopId, element.getBoundingClientRect().top)
      })
    previousStopPositions.current = positions
    setOptimisticStops(stops)
  }

  async function moveStop(stopId: string, destinationIndex: number) {
    if (!selected || busy) return
    const sourceIndex = displayedStops.findIndex((stop) => stop.id === stopId)
    if (sourceIndex < 0) return

    const stop = displayedStops[sourceIndex]
    const stops = moveItemAtInsertionIndex(displayedStops, sourceIndex, destinationIndex)
    if (stops.every((item, index) => item.id === displayedStops[index].id)) {
      setMovingStopId(null)
      return
    }

    const newPosition = stops.findIndex((item) => item.id === stopId) + 1
    updateDisplayedStops(stops)
    setMovingStopId(null)
    setReordering(true)
    setError('')
    setReorderAnnouncement(
      `Parada ${stop.locality} movida a la posición ${newPosition}. Guardando.`,
    )
    try {
      await onReorderStops(selected.id, stops)
      setReorderAnnouncement(`Orden guardado. ${stop.locality} está en la posición ${newPosition}.`)
    } catch (reason) {
      updateDisplayedStops(null)
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se ha podido actualizar el orden de las paradas.',
      )
      setReorderAnnouncement('No se pudo guardar el orden. Se ha restaurado la lista anterior.')
    } finally {
      dragState.current = null
      setDragPreview(null)
      setDraggingStopId(null)
      setDropIndex(null)
      setReordering(false)
    }
  }

  async function recalculateTimes() {
    if (!selected || recalculatingTimes || reordering) return
    setRecalculatingTimes(true)
    setError('')
    try {
      await onRecalculateTimes(selected.id)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se han podido recalcular los tiempos de trayecto.',
      )
    } finally {
      setRecalculatingTimes(false)
    }
  }

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, stopId: string) {
    if (event.button !== 0 || busy) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragState.current = {
      pointerId: event.pointerId,
      stopId,
      startX: event.clientX,
      startY: event.clientY,
      destinationIndex: null,
      isDragging: false,
    }
  }

  function updateDropTarget(event: ReactPointerEvent<HTMLButtonElement>) {
    const activeDrag = dragState.current
    if (activeDrag?.pointerId !== event.pointerId) return

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-template-drop-index], [data-template-stop-index]')
    if (!target) {
      activeDrag.destinationIndex = null
      setDropIndex(null)
      return
    }

    const dividerIndex = target.dataset.templateDropIndex
    if (dividerIndex !== undefined) {
      activeDrag.destinationIndex = Number(dividerIndex)
    } else {
      const targetIndex = Number(target.dataset.templateStopIndex)
      const { top, height } = target.getBoundingClientRect()
      activeDrag.destinationIndex = targetIndex + (event.clientY > top + height / 2 ? 1 : 0)
    }
    setDropIndex(activeDrag.destinationIndex)
  }

  function dragOver(event: ReactPointerEvent<HTMLButtonElement>) {
    const activeDrag = dragState.current
    if (activeDrag?.pointerId !== event.pointerId) return
    if (!activeDrag.isDragging) {
      if (Math.hypot(event.clientX - activeDrag.startX, event.clientY - activeDrag.startY) < 5)
        return
      activeDrag.isDragging = true
      setDraggingStopId(activeDrag.stopId)
      setMovingStopId(activeDrag.stopId)
    }
    setDragPreview({ stopId: activeDrag.stopId, x: event.clientX, y: event.clientY })
    updateDropTarget(event)
  }

  function finishDrag(event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) {
    const activeDrag = dragState.current
    if (activeDrag?.pointerId !== event.pointerId) return
    if (!cancelled && activeDrag.isDragging) updateDropTarget(event)
    const destinationIndex = activeDrag.destinationIndex
    const { isDragging, stopId } = activeDrag
    dragState.current = null
    setDragPreview(null)
    setDraggingStopId(null)
    setDropIndex(null)
    if (!isDragging) return

    setMovingStopId(null)
    suppressClickRef.current = true
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
    if (!cancelled && destinationIndex !== null) void moveStop(stopId, destinationIndex)
  }

  function moveWithKeyboard(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    stopId: string,
    index: number,
  ) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const destinationIndex = keyboardInsertionIndex(
      index,
      event.key === 'ArrowUp' ? 'up' : 'down',
      displayedStops.length,
    )
    if (destinationIndex !== null) void moveStop(stopId, destinationIndex)
  }

  function activateDivider(index: number) {
    if (movingStopId) {
      void moveStop(movingStopId, index)
      return
    }
    setAddingStopAt(index)
  }

  async function removeTemplate() {
    if (!selected) return
    setDeleting(true)
    setDeleteError('')
    try {
      await onDelete(selected.id)
      setConfirmDelete(false)
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : 'No se ha podido eliminar la ruta.')
    } finally {
      setDeleting(false)
    }
  }

  async function duplicateSelectedTemplate(direction: RouteDirection = 'normal') {
    const templateId = selected?.id
    if (!templateId) return
    setDuplicating(true)
    setError('')
    try {
      await onDuplicate(templateId, direction)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido duplicar la plantilla.')
    } finally {
      setDuplicating(false)
    }
  }

  const editingStopIndex = selected.stops.findIndex((stop) => stop.id === editingStopId)
  const nextStopAfterEditing = selected.stops[editingStopIndex + 1]?.locality

  async function removeSelectedStop() {
    if (!selected || !stopToDelete) return
    setDeletingStop(true)
    setStopDeleteError('')
    try {
      await onDeleteStop(selected.id, stopToDelete.id)
      setStopToDelete(null)
    } catch (reason) {
      setStopDeleteError(
        reason instanceof Error ? reason.message : 'No se ha podido eliminar la parada.',
      )
    } finally {
      setDeletingStop(false)
    }
  }

  function renderDivider(index: number) {
    const state = `${dropIndex === index ? 'is-drop-target' : ''} ${movingStopId && !draggingStopId ? 'is-moving' : ''}`
    const previousStop = index > 0 ? displayedStops[index - 1] : undefined
    const nextStop = displayedStops[index]
    const label = movingStopId
      ? `Mover la parada seleccionada a la posición ${index + 1}`
      : `Añadir una parada en la posición ${index + 1}`
    return (
      <li
        className={`template-divider ${previousStop ? 'has-leg' : ''} ${state}`}
        data-template-drop-index={index}
        key={`divider-${index}`}
      >
        {previousStop && nextStop && (
          <span className="template-leg-time">
            {previousStop.locality} → {nextStop.locality} ·{' '}
            {previousStop.minutes ? `${previousStop.minutes} min` : 'Sin tiempo'}
          </span>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => activateDivider(index)}
          aria-label={label}
        >
          <span />
          <Plus size={15} />
          <span />
        </button>
      </li>
    )
  }

  function renderStop(stop: RouteTemplate['stops'][number], index: number) {
    const isDragging = draggingStopId === stop.id
    const isDropBefore = dropIndex === index
    const isDropAfter = dropIndex === index + 1
    const instructions = mergedStopInstructions(stop.alias, stop.place)
    return (
      <li
        className={`${isDragging ? 'is-dragging ' : ''}${isDropBefore ? 'is-drop-before ' : ''}${isDropAfter ? 'is-drop-after' : ''}`}
        data-template-stop-id={stop.id}
        data-template-stop-index={index}
        key={stop.id}
      >
        <button
          type="button"
          className="template-stop-drag"
          aria-disabled={busy}
          onPointerDown={(event) => startDrag(event, stop.id)}
          onPointerMove={dragOver}
          onPointerUp={(event) => finishDrag(event)}
          onPointerCancel={(event) => finishDrag(event, true)}
          onLostPointerCapture={(event) => finishDrag(event, true)}
          onKeyDown={(event) => moveWithKeyboard(event, stop.id, index)}
          onClick={() => {
            if (suppressClickRef.current || busy) return
            setMovingStopId((current) => (current === stop.id ? null : stop.id))
          }}
          aria-pressed={movingStopId === stop.id}
          aria-label={`Mover ${stop.locality}, posición ${index + 1} de ${displayedStops.length}`}
          aria-describedby="template-reorder-help"
          aria-keyshortcuts="ArrowUp ArrowDown"
          title="Arrastra para reordenar; usa las flechas del teclado o selecciona un destino"
        >
          <GripVertical size={18} />
        </button>
        <div className="stop-index">{index + 1}</div>
        <div>
          <strong>{stop.locality}</strong>
          {instructions && <p>{instructions}</p>}
        </div>
        <a
          href={stop.mapUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Abrir ${stop.locality} en mapas`}
        >
          <MapPin size={17} />
        </a>
        <div className="template-stop-actions">
          <button
            type="button"
            className="template-stop-action"
            disabled={busy}
            aria-label={`Editar parada ${stop.locality}`}
            title={`Editar parada ${stop.locality}`}
            onClick={() => setEditingStopId(stop.id)}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="template-stop-action is-destructive"
            disabled={busy}
            aria-label={`Eliminar parada ${stop.locality}`}
            title={`Eliminar parada ${stop.locality}`}
            onClick={() => {
              setStopDeleteError('')
              setStopToDelete(stop)
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </li>
    )
  }

  return (
    <>
      <PageIntro text="El orden de las paradas se conservará al crear una ruta diaria." />
      <div className="template-layout">
        <Card className="template-list">
          <CardContent>
            <h3>Plantillas</h3>
            {templates.map((template) => (
              <button
                type="button"
                key={template.id}
                disabled={busy}
                onClick={() => onSelect(template)}
                className={`template-row ${selected.id === template.id ? 'is-selected' : ''}`}
              >
                <span className="template-dot" style={{ background: template.color }} />
                <span>
                  <strong>{template.name}</strong>
                  <small>{template.stops.length} paradas</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </CardContent>
        </Card>
        <Card className="stops-card">
          <CardContent>
            <div className="template-header">
              <div>
                <h3>Ruta {selected.name}</h3>
              </div>
              <div className="template-header-actions">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setAddingStopAt(selected.stops.length)}
                >
                  <Plus /> Añadir parada
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setEditing(true)}>
                  <Pencil /> Editar
                </Button>
                <DropdownMenu
                  trigger={
                    <Button
                      variant="outline"
                      size="icon"
                      className="template-header-more"
                      disabled={busy || duplicating}
                      aria-label={
                        recalculatingTimes
                          ? 'Calculando tiempos…'
                          : duplicating
                            ? 'Duplicando plantilla…'
                            : 'Más opciones de la plantilla'
                      }
                    >
                      {recalculatingTimes || duplicating ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <MoreHorizontal />
                      )}
                    </Button>
                  }
                  placement="bottom end"
                  className="min-w-48"
                >
                  <DropdownMenuItem
                    isDisabled={selected.stops.length < 2 || busy}
                    onAction={() => void recalculateTimes()}
                  >
                    <Clock3 /> {recalculatingTimes ? 'Calculando…' : 'Recalcular tiempos'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    isDisabled={duplicating || busy}
                    onAction={() => void duplicateSelectedTemplate()}
                  >
                    <Copy /> {duplicating ? 'Duplicando…' : 'Duplicar plantilla'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    isDisabled={duplicating || busy}
                    onAction={() => void duplicateSelectedTemplate('inversa')}
                  >
                    <Copy /> {duplicating ? 'Duplicando…' : 'Duplicar plantilla invertida'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    isDisabled={templates.length <= 1 || busy || duplicating}
                    onAction={() => {
                      setDeleteError('')
                      setConfirmDelete(true)
                    }}
                  >
                    <Trash2 /> Eliminar plantilla
                  </DropdownMenuItem>
                </DropdownMenu>
              </div>
            </div>
            {movingStopId && (
              <output className="template-move-notice" aria-live="polite">
                {draggingStopId
                  ? dropIndex === null
                    ? 'Arrastra la parada a un destino de la lista.'
                    : dropIndex === displayedStops.length
                      ? 'Se colocará al final de la lista.'
                      : `Se colocará antes de ${displayedStops[dropIndex]?.locality}.`
                  : 'Elige el divisor de destino o usa las flechas del teclado.'}
              </output>
            )}
            <p id="template-reorder-help" className="sr-only">
              Arrastra el asa para mover la parada, usa las flechas arriba y abajo o selecciónala y
              elige un divisor de destino.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <ol className="stops-list" ref={stopListRef} aria-label="Paradas de la plantilla">
              {[
                ...displayedStops.flatMap((stop, index) => [
                  renderDivider(index),
                  renderStop(stop, index),
                ]),
                renderDivider(displayedStops.length),
              ]}
            </ol>
            {reordering && <p className="template-reorder-saving">Guardando el nuevo orden…</p>}
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {reorderAnnouncement}
            </p>
            {dragPreview && (
              <div
                className="template-drag-preview"
                aria-hidden="true"
                style={{
                  transform: `translate3d(${Math.max(12, Math.min(dragPreview.x + 14, window.innerWidth - Math.min(320, window.innerWidth - 24) - 12))}px, ${Math.max(12, Math.min(dragPreview.y + 14, window.innerHeight - 82))}px, 0)`,
                }}
              >
                <span className="stop-index">
                  {displayedStops.findIndex((stop) => stop.id === dragPreview.stopId) + 1}
                </span>
                <span>
                  <strong>
                    {displayedStops.find((stop) => stop.id === dragPreview.stopId)?.locality}
                  </strong>
                  <small>Suelta para colocar la parada</small>
                </span>
                <GripVertical size={18} aria-hidden="true" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {creating && <NewTemplateDialog onClose={() => setCreating(false)} onCreate={onCreate} />}
      {editing && (
        <NewTemplateDialog
          template={selected}
          onClose={() => setEditing(false)}
          onCreate={onCreate}
          onUpdate={onUpdate}
        />
      )}
      {addingStopAt !== null && (
        <StopFormDialog
          meetingPoints={meetingPoints}
          insertionIndex={addingStopAt}
          nextStopLocality={selected.stops[addingStopAt]?.locality}
          stopCount={selected.stops.length}
          onInsertionIndexChange={setAddingStopAt}
          onClose={() => setAddingStopAt(null)}
          onAdd={async (stop) => {
            await onAddStop(selected.id, stop, addingStopAt)
            setAddingStopAt(null)
          }}
        />
      )}
      {editingStopId !== null && selected.stops.some((stop) => stop.id === editingStopId) && (
        <StopFormDialog
          initialStop={selected.stops.find((stop) => stop.id === editingStopId)}
          nextStopLocality={nextStopAfterEditing}
          onClose={() => setEditingStopId(null)}
          onAdd={async (stop) => {
            await onUpdateStop(selected.id, editingStopId, stop)
            setEditingStopId(null)
          }}
        />
      )}
      <AlertDialog
        open={Boolean(stopToDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingStop) {
            setStopToDelete(null)
            setStopDeleteError('')
          }
        }}
      >
        <AlertDialogContent className="delete-template-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar parada de la plantilla</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>{stopToDelete?.locality}</strong> de la plantilla{' '}
              <strong>{selected.name}</strong>. Las rutas diarias existentes no cambiarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {stopDeleteError && (
            <p className="form-error" role="alert">
              {stopDeleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingStop}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletingStop}
              onClick={() => void removeSelectedStop()}
            >
              <Trash2 /> {deletingStop ? 'Eliminando…' : 'Eliminar parada'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setConfirmDelete(false)
            setDeleteError('')
          }
        }}
      >
        <AlertDialogContent className="delete-template-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar plantilla de ruta</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>{selected.name}</strong> y sus {selected.stops.length}{' '}
              {selected.stops.length === 1 ? 'parada' : 'paradas'}. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="form-error" role="alert">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={() => void removeTemplate()}
            >
              <Trash2 /> {deleting ? 'Eliminando…' : 'Eliminar ruta'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
