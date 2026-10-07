import { Button, Input } from '@doscientos/ui'
import { MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import type { SavedMeetingPoint } from '@/shared/types'

type MeetingPointDraft = Omit<SavedMeetingPoint, 'id' | 'latitude' | 'longitude'> & {
  latitude: string
  longitude: string
}

type Props = {
  meetingPoints: SavedMeetingPoint[]
  onSave: (point: SavedMeetingPoint | Omit<SavedMeetingPoint, 'id'>) => Promise<unknown>
  onDelete: (id: string) => Promise<void>
}

const emptyDraft = (): MeetingPointDraft => ({
  name: '',
  locality: '',
  place: '',
  street: '',
  streetNumber: '',
  floor: '',
  postalCode: '',
  province: '',
  country: 'España',
  latitude: '',
  longitude: '',
})

const fields: Array<{ key: keyof MeetingPointDraft; label: string }> = [
  { key: 'name', label: 'Nombre del punto' },
  { key: 'locality', label: 'Localidad' },
  { key: 'street', label: 'Calle o vía' },
  { key: 'streetNumber', label: 'Número' },
  { key: 'postalCode', label: 'Código postal' },
  { key: 'province', label: 'Provincia' },
  { key: 'country', label: 'País' },
  { key: 'floor', label: 'Piso, portal o local' },
]

export function MeetingPointsSettings({ meetingPoints, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  function resetForm() {
    setDraft(emptyDraft())
    setEditingId(null)
    setFormOpen(false)
    setError('')
  }

  function editPoint(point: SavedMeetingPoint) {
    setDraft({ ...point, latitude: String(point.latitude), longitude: String(point.longitude) })
    setEditingId(point.id)
    setFormOpen(true)
    setError('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const latitude = Number(draft.latitude)
    const longitude = Number(draft.longitude)
    if (
      !draft.name.trim() ||
      !draft.locality.trim() ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      setError('Indica un nombre, una localidad y unas coordenadas válidas.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const point = {
        ...draft,
        name: draft.name.trim(),
        locality: draft.locality.trim(),
        place: draft.place.trim(),
        street: draft.street.trim(),
        streetNumber: draft.streetNumber.trim(),
        floor: draft.floor.trim(),
        postalCode: draft.postalCode.trim(),
        province: draft.province.trim(),
        country: draft.country.trim() || 'España',
        latitude,
        longitude,
      }
      await onSave(editingId ? { ...point, id: editingId } : point)
      resetForm()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se ha podido guardar el punto de encuentro.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function deletePoint(point: SavedMeetingPoint) {
    if (!window.confirm(`¿Eliminar ${point.name} de la biblioteca?`)) return
    setDeletingId(point.id)
    setError('')
    try {
      await onDelete(point.id)
      if (editingId === point.id) resetForm()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se ha podido eliminar el punto de encuentro.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="settings-support settings-pricing meeting-points-settings">
      <div className="settings-pricing-heading">
        <h2>Puntos de encuentro</h2>
        <p>
          Guarda puntos habituales para rellenar sus datos al añadir paradas a rutas y plantillas.
          Las rutas ya creadas no cambian al editar o eliminar un punto de esta biblioteca.
        </p>
      </div>
      <div className="meeting-points-actions">
        <span>{meetingPoints.length} puntos guardados</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            resetForm()
            setFormOpen(true)
          }}
        >
          <Plus size={16} /> Añadir punto
        </Button>
      </div>
      {formOpen && (
        <form className="meeting-points-form" onSubmit={(event) => void save(event)}>
          <div className="meeting-points-form-grid">
            {fields.map(({ key, label }) => (
              <label className="settings-pricing-field" key={key}>
                {label}
                <Input
                  value={draft[key]}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [key]: event.target.value }))
                  }
                  required={key === 'name' || key === 'locality'}
                  disabled={saving}
                />
              </label>
            ))}
            <label className="settings-pricing-field">
              Latitud
              <Input
                type="number"
                step="any"
                value={draft.latitude}
                onChange={(event) => setDraft((current) => ({ ...current, latitude: event.target.value }))}
                required
                disabled={saving}
              />
            </label>
            <label className="settings-pricing-field">
              Longitud
              <Input
                type="number"
                step="any"
                value={draft.longitude}
                onChange={(event) => setDraft((current) => ({ ...current, longitude: event.target.value }))}
                required
                disabled={saving}
              />
            </label>
            <label className="settings-pricing-field meeting-points-instructions">
              Indicaciones
              <Input
                value={draft.place}
                onChange={(event) => setDraft((current) => ({ ...current, place: event.target.value }))}
                placeholder="Ej. junto a la gasolinera, entrada principal"
                disabled={saving}
              />
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="settings-pricing-actions">
            <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
              <X size={16} /> Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Guardar punto'}
            </Button>
          </div>
        </form>
      )}
      {meetingPoints.length ? (
        <ul className="meeting-points-list">
          {meetingPoints.map((point) => (
            <li key={point.id}>
              <div className="meeting-points-summary">
                <strong>
                  <MapPin size={15} /> {point.name} · {point.locality}
                </strong>
                <span>
                  {[
                    [point.street, point.streetNumber].filter(Boolean).join(' '),
                    point.postalCode,
                    point.province,
                    point.place,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Coordenadas guardadas'}
                </span>
              </div>
              <div className="meeting-points-item-actions">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => editPoint(point)}
                  aria-label={`Editar ${point.name} en ${point.locality}`}
                >
                  <Pencil size={15} /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deletingId === point.id}
                  onClick={() => void deletePoint(point)}
                  aria-label={`Eliminar ${point.name} en ${point.locality}`}
                >
                  <Trash2 size={15} /> Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="meeting-points-empty">Todavía no hay puntos guardados.</p>
      )}
    </section>
  )
}