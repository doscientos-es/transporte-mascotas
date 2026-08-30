import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@doscientos/ui'
import { ArrowRightLeft, MapPin, PawPrint, Printer, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'

import { statusLabels } from '@/shared/lib/status-labels'
import type { AnimalSize, DailyRoute, Letter, RouteTemplate, ServiceAction } from '@/shared/types'
import { PageIntro } from '@/shared/ui/page-intro'

import { boxGridSpan, boxSize, type VanAssignment, vanLanes } from '../application/van'

type BoxAnimalDetails = {
  pickup: ServiceAction
  delivery?: ServiceAction
  animalLabel: string
  animalSize?: AnimalSize
  compatibleBoxes: number[]
  showReassignmentControl: boolean
}

const boxSizeLabel: Record<AnimalSize, string> = {
  pequeno: 'Pequeño',
  mediano: 'Mediano',
  grande: 'Grande',
}

export function VanPage({
  route,
  routes,
  templates,
  letters,
  assignments,
  canManage,
  onSelectRoute,
  onReassignBox,
  onPrint,
  printing = false,
}: {
  route: DailyRoute
  routes: DailyRoute[]
  templates: RouteTemplate[]
  letters: Letter[]
  assignments: VanAssignment[]
  canManage: boolean
  onSelectRoute: (route: DailyRoute) => void
  onReassignBox: (letterId: string, box: number) => Promise<void>
  onPrint: () => void
  printing?: boolean
}) {
  const [selectedBox, setSelectedBox] = useState<number | null>(null)
  const leftLanes = vanLanes.filter((lane) => lane.side === 'left')
  const rightLanes = vanLanes.filter((lane) => lane.side === 'right')
  const totalBoxes = vanLanes.reduce((total, lane) => total + lane.boxes.length, 0)
  const animalsOnBoard = assignments.reduce(
    (total, assignment) => total + assignment.animalCount,
    0,
  )
  const selectedAssignment = assignments.find((assignment) => assignment.box === selectedBox)
  const routeName = (item: DailyRoute) =>
    templates.find((template) => template.id === item.templateId)?.name ?? 'Ruta sin plantilla'
  const routeOptionLabel = (item: DailyRoute) =>
    `${routeName(item)} · ${new Date(`${item.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
  const reassignmentShownFor = new Set<string>()
  const selectedBoxDetails: BoxAnimalDetails[] =
    selectedBox === null
      ? []
      : route.actions
          .filter((action) => action.type === 'recogida' && action.box === selectedBox)
          .map((pickup) => {
            const animal = letters
              .find((letter) => letter.id === pickup.letterId)
              ?.animals.find((item) => item.id === pickup.animalId)
            const letterAnimals =
              letters.find((letter) => letter.id === pickup.letterId)?.animals ?? []
            const showReassignmentControl = canManage && !reassignmentShownFor.has(pickup.letterId)
            const compatibleBoxes = vanLanes
              .flatMap((lane) => lane.boxes)
              .filter(
                (candidate) =>
                  !letterAnimals.length ||
                  letterAnimals.every((item) => {
                    const candidateSize = boxSize(candidate)
                    return (
                      candidateSize === item.size ||
                      (item.size === 'pequeno' && candidateSize !== 'pequeno') ||
                      (item.size === 'mediano' && candidateSize === 'grande')
                    )
                  }),
              )
            reassignmentShownFor.add(pickup.letterId)
            return {
              pickup,
              delivery: route.actions.find(
                (action) =>
                  action.type === 'entrega' &&
                  action.box === selectedBox &&
                  action.letterId === pickup.letterId &&
                  action.animalId === pickup.animalId,
              ),
              animalLabel:
                pickup.animalLabel ??
                (animal
                  ? [animal.breed, animal.species].filter(Boolean).join(' · ')
                  : 'Mascota sin identificar'),
              animalSize: animal?.size,
              compatibleBoxes,
              showReassignmentControl,
            }
          })
  useEffect(() => {
    setSelectedBox(null)
  }, [route.id])
  const renderLane = (lane: (typeof vanLanes)[number]) => (
    <div className={`van-lane ${lane.id}`} key={lane.id}>
      {lane.boxes.map((box) => {
        const assignment = assignments.find((entry) => entry.box === box)
        const description = assignment
          ? `${assignment.label} · ${assignment.animalCount} animales`
          : `Box ${box} libre`
        return (
          <button
            type="button"
            style={{ gridRow: `span ${boxGridSpan[lane.size]}` }}
            title={description}
            aria-label={description}
            aria-pressed={selectedBox === box}
            onClick={() => setSelectedBox(box)}
            key={box}
            className={`van-box box-${boxSize(box)} ${assignment ? 'is-occupied' : ''} ${selectedBox === box ? 'is-selected' : ''}`}
          >
            <b>{box}</b>
            {assignment && (
              <span>
                {assignment.label.replace('CARTA DE PORTE Nº ', '#')} · {assignment.animalCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
  return (
    <>
      <PageIntro text="Consulta la ocupación de cada ruta y cambia de recorrido sin salir de la furgoneta.">
        <div className="van-toolbar">
          <label className="van-route-picker">
            <span>Ruta mostrada</span>
            <select
              value={route.id}
              onChange={(event) => {
                const selected = routes.find((item) => item.id === event.target.value)
                if (selected) onSelectRoute(selected)
              }}
            >
              {routes.map((item) => (
                <option key={item.id} value={item.id}>
                  {routeOptionLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={printing} onClick={onPrint}>
            <Printer /> {printing ? 'Preparando PDF…' : 'Imprimir tramo'}
          </Button>
        </div>
      </PageIntro>
      <section className="van-summary" aria-label={`Resumen de ocupación de ${routeName(route)}`}>
        <div>
          <span>Boxes ocupados</span>
          <strong>
            {assignments.length}
            <small> de {totalBoxes}</small>
          </strong>
        </div>
        <div>
          <span>Mascotas a bordo</span>
          <strong>{animalsOnBoard}</strong>
        </div>
        <div>
          <span>Disponibilidad</span>
          <strong>
            {totalBoxes - assignments.length}
            <small> boxes libres</small>
          </strong>
        </div>
      </section>
      <div className="van-legend">
        <span>
          <i className="box-large" /> Grandes 1–4, 37–40
        </span>
        <span>
          <i className="box-medium" /> Medianos 5–12, 41–48
        </span>
        <span>
          <i className="box-small" /> Pequeños 13–36, 49–72
        </span>
      </div>
      <Card className="van-card">
        <CardContent>
          <div className="van-title">F U R G Ó N</div>
          <div className="van-plan">
            <div className="van-front">PARTE DELANTERA (CONDUCTORES)</div>
            <div className="van-banks van-banks-left">{leftLanes.map(renderLane)}</div>
            <div className="van-aisle">P A S I L L O</div>
            <div className="van-banks van-banks-right">{rightLanes.map(renderLane)}</div>
          </div>
        </CardContent>
      </Card>
      <output className="van-selection">
        {selectedBox === null
          ? 'Selecciona un box en el plano para ver su ocupación y los animales asignados.'
          : selectedAssignment
            ? `Abriendo el detalle del box ${selectedBox}.`
            : `Abriendo el detalle del box ${selectedBox}, disponible para una nueva asignación.`}
      </output>
      <section className="assignments">
        <h3>Asignaciones activas</h3>
        {assignments.length ? (
          assignments.map((assignment) => {
            const pickup = route.actions.find(
              (action) =>
                action.type === 'recogida' &&
                action.letterId === assignment.label &&
                action.box === assignment.box,
            )
            return (
              <div key={`${assignment.label}:${assignment.box}`}>
                <span className={`box-chip box-${boxSize(assignment.box)}`}>{assignment.box}</span>
                <div>
                  <strong>{assignment.label}</strong>
                  <p>
                    {assignment.animalCount} {assignment.animalCount === 1 ? 'animal' : 'animales'}{' '}
                    · Recogida{pickup ? ` · ${pickup.stop}` : ''}
                  </p>
                </div>
                {pickup && (
                  <span className={`status status-${pickup.status}`}>
                    {statusLabels[pickup.status]}
                  </span>
                )}
              </div>
            )
          })
        ) : (
          <p className="empty-copy">No hay asignaciones activas para esta ruta.</p>
        )}
      </section>
      {selectedBox !== null && (
        <BoxDetailsDialog
          box={selectedBox}
          routeName={routeName(route)}
          routeDate={route.date}
          animals={selectedBoxDetails}
          canManage={canManage}
          onReassign={async (letterId, box) => {
            await onReassignBox(letterId, box)
            setSelectedBox(null)
          }}
          onClose={() => setSelectedBox(null)}
        />
      )}
    </>
  )
}

function BoxDetailsDialog({
  box,
  routeName,
  routeDate,
  animals,
  canManage,
  onReassign,
  onClose,
}: {
  box: number
  routeName: string
  routeDate: string
  animals: BoxAnimalDetails[]
  canManage: boolean
  onReassign: (letterId: string, box: number) => Promise<void>
  onClose: () => void
}) {
  const size = boxSize(box)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="dialog-card box-details-dialog">
        <DialogHeader className="gap-0">
          <div className="dialog-icon">
            <PawPrint size={23} />
          </div>
          <DialogTitle>Box {box}</DialogTitle>
          <DialogDescription>
            {animals.length
              ? `${animals.length} ${animals.length === 1 ? 'animal asignado' : 'animales asignados'} en esta ruta.`
              : 'Este box está libre en la ruta mostrada.'}
          </DialogDescription>
        </DialogHeader>
        <dl className="box-details-summary">
          <div>
            <dt>Ruta</dt>
            <dd>{routeName}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>
              {new Date(`${routeDate}T12:00:00`).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
              })}
            </dd>
          </div>
          <div>
            <dt>Tamaño</dt>
            <dd>{boxSizeLabel[size]}</dd>
          </div>
        </dl>
        {animals.length ? (
          <div className="box-animal-list">
            {animals.map(
              ({
                pickup,
                delivery,
                animalLabel,
                animalSize,
                compatibleBoxes,
                showReassignmentControl,
              }) => (
                <article className="box-animal-card" key={pickup.id}>
                  <div className="box-animal-heading">
                    <span className={`box-chip box-${size}`}>
                      <PawPrint size={15} />
                    </span>
                    <div>
                      <strong>{animalLabel}</strong>
                      <small>
                        {animalSize
                          ? `Tamaño ${boxSizeLabel[animalSize].toLocaleLowerCase()}`
                          : 'Tamaño no indicado'}{' '}
                        · {pickup.letterId}
                      </small>
                    </div>
                    <span className={`status status-${pickup.status}`}>
                      {statusLabels[pickup.status]}
                    </span>
                  </div>
                  <dl className="box-animal-details">
                    <div>
                      <dt>
                        <UserRound size={14} /> Recogida
                      </dt>
                      <dd>
                        {pickup.customer} · {pickup.stop}
                      </dd>
                    </div>
                    <div>
                      <dt>
                        <MapPin size={14} /> Entrega
                      </dt>
                      <dd>
                        {delivery
                          ? `${delivery.customer} · ${delivery.stop} · ${statusLabels[delivery.status]}`
                          : 'Sin entrega programada'}
                      </dd>
                    </div>
                  </dl>
                  {canManage && showReassignmentControl && (
                    <ReassignBoxControl
                      letterId={pickup.letterId}
                      currentBox={box}
                      compatibleBoxes={compatibleBoxes}
                      onReassign={onReassign}
                    />
                  )}
                </article>
              ),
            )}
          </div>
        ) : (
          <div className="box-empty-state">
            <PawPrint size={20} />
            <div>
              <strong>Box disponible</strong>
              <p>No hay animales asignados a este box en esta ruta.</p>
            </div>
          </div>
        )}
        <Button className="dialog-submit" variant="outline" onClick={onClose}>
          Cerrar detalle
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function ReassignBoxControl({
  letterId,
  currentBox,
  compatibleBoxes,
  onReassign,
}: {
  letterId: string
  currentBox: number
  compatibleBoxes: number[]
  onReassign: (letterId: string, box: number) => Promise<void>
}) {
  const [targetBox, setTargetBox] = useState(String(currentBox))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    setSaving(true)
    setError('')
    try {
      await onReassign(letterId, Number(targetBox))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido cambiar el box.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <section className="box-reassignment">
      <div>
        <strong>
          <ArrowRightLeft size={15} /> Reasignar box
        </strong>
        <p>El cambio se aplica a todos los animales de esta carta.</p>
      </div>
      <label>
        Nuevo box
        <select
          value={targetBox}
          onChange={(event) => {
            setTargetBox(event.target.value)
            setError('')
          }}
          disabled={saving}
        >
          {compatibleBoxes.map((candidate) => (
            <option key={candidate} value={candidate}>
              Box {candidate} · {boxSizeLabel[boxSize(candidate)]}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button
        type="button"
        size="sm"
        disabled={saving || Number(targetBox) === currentBox}
        onClick={() => void submit()}
      >
        <ArrowRightLeft size={15} /> {saving ? 'Cambiando…' : 'Confirmar cambio'}
      </Button>
    </section>
  )
}
