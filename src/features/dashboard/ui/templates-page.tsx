import { Button, Card, CardContent } from '@doscientos/ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@doscientos/ui'
import { ChevronRight, GripVertical, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { type DragEvent, useEffect, useState } from 'react'

import type { RouteTemplate } from '@/shared/types'
import { PageIntro } from '@/shared/ui/page-intro'

import { NewTemplateDialog, StopFormDialog, type StopFormValues } from './operation-dialogs'

type Props = {
  templates: RouteTemplate[]
  selected: RouteTemplate | null
  onSelect: (template: RouteTemplate) => void
  onCreate: (name: string, color: string) => Promise<void>
  onUpdate: (templateId: string, name: string, color: string) => Promise<void>
  onDelete: (templateId: string) => Promise<void>
  onAddStop: (templateId: string, stop: StopFormValues, insertionIndex?: number) => Promise<void>
  onReorderStops: (templateId: string, stops: RouteTemplate['stops']) => Promise<void>
}

export function TemplatesPage({
  templates,
  selected,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onAddStop,
  onReorderStops,
}: Props) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [addingStopAt, setAddingStopAt] = useState<number | null>(null)
  const [movingStopId, setMovingStopId] = useState<string | null>(null)
  const [draggingStopId, setDraggingStopId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setAddingStopAt(null)
    setMovingStopId(null)
    setDraggingStopId(null)
    setDropIndex(null)
    setError('')
  }, [selected?.id])

  if (!selected)
    return (
      <>
        <PageIntro text="Crea una ruta preestablecida para empezar a organizar los transportes.">
          <Button onClick={() => setCreating(true)}>
            <Plus /> Nueva ruta
          </Button>
        </PageIntro>
        <Card className="stops-card">
          <CardContent>
            <p>Aún no hay rutas preestablecidas guardadas.</p>
          </CardContent>
        </Card>
        {creating && <NewTemplateDialog onClose={() => setCreating(false)} onCreate={onCreate} />}
      </>
    )

  async function moveStop(stopId: string, destinationIndex: number) {
    if (!selected) return
    const sourceIndex = selected.stops.findIndex((stop) => stop.id === stopId)
    if (sourceIndex < 0) return

    const stops = [...selected.stops]
    const [moved] = stops.splice(sourceIndex, 1)
    const insertAt = Math.max(
      0,
      Math.min(destinationIndex - (sourceIndex < destinationIndex ? 1 : 0), stops.length),
    )
    stops.splice(insertAt, 0, moved)
    if (stops.every((stop, index) => stop.id === selected.stops[index].id)) {
      setMovingStopId(null)
      return
    }

    setReordering(true)
    setError('')
    try {
      await onReorderStops(selected.id, stops)
      setMovingStopId(null)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se ha podido actualizar el orden de las paradas.',
      )
    } finally {
      setDraggingStopId(null)
      setDropIndex(null)
      setReordering(false)
    }
  }

  function startDrag(event: DragEvent<HTMLButtonElement>, stopId: string) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', stopId)
    setDraggingStopId(stopId)
    setMovingStopId(stopId)
  }

  function dropAt(event: DragEvent<HTMLElement>, index: number) {
    event.preventDefault()
    const stopId = event.dataTransfer.getData('text/plain') || draggingStopId
    if (stopId) void moveStop(stopId, index)
  }

  function dropIndexForStop(event: DragEvent<HTMLElement>, index: number) {
    const { top, height } = event.currentTarget.getBoundingClientRect()
    return event.clientY < top + height / 2 ? index : index + 1
  }

  function dragOverStop(event: DragEvent<HTMLElement>, index: number) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropIndex(dropIndexForStop(event, index))
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

  function renderDivider(index: number) {
    const state = `${dropIndex === index ? 'is-drop-target' : ''} ${movingStopId ? 'is-moving' : ''}`
    const label = movingStopId
      ? `Mover la parada seleccionada a la posición ${index + 1}`
      : `Añadir una parada en la posición ${index + 1}`
    return (
      <li className={`template-divider ${state}`} key={`divider-${index}`}>
        <button
          type="button"
          disabled={reordering}
          onClick={() => activateDivider(index)}
          aria-label={label}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDropIndex(index)
          }}
          onDragLeave={() => setDropIndex(null)}
          onDrop={(event) => dropAt(event, index)}
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
    return (
      <li
        className={`${isDragging ? 'is-dragging ' : ''}${isDropBefore ? 'is-drop-before ' : ''}${isDropAfter ? 'is-drop-after' : ''}`}
        key={stop.id}
      >
        <div className="stop-index">{index + 1}</div>
        <div>
          <strong>{stop.locality}</strong>
          <p>{stop.place}</p>
        </div>
        <span className="duration">{stop.minutes ? `${stop.minutes} min` : 'Final'}</span>
        <a
          href={stop.mapUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Abrir ${stop.locality} en mapas`}
        >
          <MapPin size={17} />
        </a>
        <button
          type="button"
          className="template-stop-drag"
          disabled={reordering}
          draggable
          onDragStart={(event) => startDrag(event, stop.id)}
          onDragOver={(event) => dragOverStop(event, index)}
          onDrop={(event) => dropAt(event, dropIndexForStop(event, index))}
          onDragEnd={() => {
            setDraggingStopId(null)
            setDropIndex(null)
          }}
          onClick={() => setMovingStopId((current) => (current === stop.id ? null : stop.id))}
          aria-pressed={movingStopId === stop.id}
          aria-label={`Mover ${stop.locality}`}
          title="Arrastra para reordenar o pulsa para elegir destino"
        >
          <GripVertical size={18} />
        </button>
      </li>
    )
  }

  return (
    <>
      <PageIntro text="El orden de las paradas se conservará al crear una ruta diaria.">
        <Button onClick={() => setCreating(true)}>
          <Plus /> Nueva ruta
        </Button>
      </PageIntro>
      <div className="template-layout">
        <Card className="template-list">
          <CardContent>
            <h3>Plantillas</h3>
            {templates.map((template) => (
              <button
                type="button"
                key={template.id}
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
                <span className="eyebrow">Plantilla activa</span>
                <h3>Ruta {selected.name}</h3>
              </div>
              <div className="template-header-actions">
                <Button variant="outline" onClick={() => setAddingStopAt(selected.stops.length)}>
                  <Plus /> Añadir parada
                </Button>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil /> Editar
                </Button>
                <Button
                  variant="outline"
                  className="template-delete-button"
                  disabled={templates.length <= 1}
                  aria-description={
                    templates.length <= 1
                      ? 'Debe existir al menos una ruta preestablecida.'
                      : 'Eliminar esta ruta'
                  }
                  onClick={() => {
                    setDeleteError('')
                    setConfirmDelete(true)
                  }}
                >
                  <Trash2 /> Eliminar
                </Button>
              </div>
            </div>
            {movingStopId && (
              <output className="template-move-notice">
                Elige el divisor de destino o arrastra la parada desde su asa.
              </output>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <ol className="stops-list">
              {[
                ...selected.stops.flatMap((stop, index) => [
                  renderDivider(index),
                  renderStop(stop, index),
                ]),
                renderDivider(selected.stops.length),
              ]}
            </ol>
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
          insertionIndex={addingStopAt}
          stopCount={selected.stops.length}
          onInsertionIndexChange={setAddingStopAt}
          onClose={() => setAddingStopAt(null)}
          onAdd={async (stop) => {
            await onAddStop(selected.id, stop, addingStopAt)
            setAddingStopAt(null)
          }}
        />
      )}
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
            <AlertDialogTitle>Eliminar ruta preestablecida</AlertDialogTitle>
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
