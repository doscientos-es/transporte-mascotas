import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CreditCard,
  FilePenLine,
  FilePlus2,
  MapPin,
  PawPrint,
  Pencil,
  Plus,
  Printer,
  Route,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { lookupAddressSuggestions, type AddressSuggestion } from '../lib/address-lookup'
import type {
  AccompanyingDocument,
  DailyRoute,
  DailyRouteStop,
  InvoiceClientInput,
  InvoicePayer,
  Letter,
  LetterDraft,
  PaymentDelivery,
  PaymentDeliveryChannel,
  RouteDirection,
  RouteTemplate,
  Transporter,
} from '../lib/types'

type OperationDialogProps = {
  children: ReactNode
  description: string
  icon: ReactNode
  onClose: () => void
  title: string
  wide?: boolean
}

function OperationDialog({
  children,
  description,
  icon,
  onClose,
  title,
  wide = false,
}: OperationDialogProps) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className={`dialog-card w-[calc(100%-2.5rem)]! p-6.5! ${wide ? 'max-w-190!' : 'max-w-115!'}`}
      >
        <DialogHeader className="gap-0">
          <div className="dialog-icon">{icon}</div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

const emptyInvoiceClient = (): InvoiceClientInput => ({
  fullName: '',
  nif: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
})
const emptyAnimal = () => ({
  species: 'Canina',
  breed: '',
  birthDate: '',
  size: 'pequeno' as const,
})
const emptyLetter: LetterDraft = {
  reference: '',
  routeId: '',
  origin: '',
  destination: '',
  originPoint: '',
  destinationPoint: '',
  sender: '',
  senderPhone: '',
  senderEmail: '',
  senderNif: '',
  senderAddress: '',
  senderPostalCode: '',
  senderCity: '',
  senderProvince: '',
  recipient: '',
  recipientPhone: '',
  recipientEmail: '',
  recipientNif: '',
  recipientAddress: '',
  recipientPostalCode: '',
  recipientCity: '',
  recipientProvince: '',
  accompanyingDocuments: [],
  billingPayer: 'remitente',
  otherPayer: emptyInvoiceClient(),
  signatureConfirmed: false,
  animals: [emptyAnimal()],
}
const todayIso = () => {
  const today = new Date()
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset())
  return today.toISOString().slice(0, 10)
}

export function LetterFormDialog({
  routes,
  templates,
  onClose,
  onCreate,
  onAddStop,
  letter,
  routeId,
}: {
  routes: DailyRoute[]
  templates: RouteTemplate[]
  onClose: () => void
  onCreate: (draft: LetterDraft) => Promise<void>
  onAddStop: (routeId: string, stop: StopFormValues) => Promise<DailyRouteStop>
  letter?: Letter
  routeId?: string
}) {
  const isEditing = Boolean(letter)
  const [draft, setDraft] = useState<LetterDraft>(() =>
    letter
      ? {
          reference: letter.id.replace(/^CARTA DE PORTE Nº\s*/i, ''),
          routeId: routeId ?? '',
          sender: letter.sender,
          senderPhone: letter.senderPhone,
          senderEmail: letter.senderEmail,
          senderNif: letter.senderNif,
          senderAddress: letter.senderAddress,
          senderPostalCode: letter.senderPostalCode,
          senderCity: letter.senderCity,
          senderProvince: letter.senderProvince,
          recipient: letter.recipient,
          recipientPhone: letter.recipientPhone,
          recipientEmail: letter.recipientEmail,
          recipientNif: letter.recipientNif,
          recipientAddress: letter.recipientAddress,
          recipientPostalCode: letter.recipientPostalCode,
          recipientCity: letter.recipientCity,
          recipientProvince: letter.recipientProvince,
          origin: letter.origin,
          destination: letter.destination,
          originPoint: letter.originPoint,
          destinationPoint: letter.destinationPoint,
          accompanyingDocuments: letter.accompanyingDocuments,
          billingPayer: letter.billingPayer,
          otherPayer:
            letter.billingPayer === 'manual' ? letter.billingClient : emptyInvoiceClient(),
          signatureConfirmed: false,
          animals: letter.animals.map(({ species, breed, birthDate, size }) => ({
            species,
            breed,
            birthDate,
            size,
          })),
        }
      : emptyLetter,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [addingStopFor, setAddingStopFor] = useState<'origin' | 'destination' | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const selectedRoute = routes.find((route) => route.id === draft.routeId)
  const selectedTemplate = templates.find((template) => template.id === selectedRoute?.templateId)
  const stops = useMemo(
    () => [
      ...new Set(
        selectedRoute?.stops?.map((stop) => stop.locality) ??
          selectedTemplate?.stops.map((stop) => stop.locality) ??
          [],
      ),
    ],
    [selectedRoute, selectedTemplate],
  )
  const update = <K extends Exclude<keyof LetterDraft, 'animals'>>(
    field: K,
    value: LetterDraft[K],
  ) => setDraft((current) => ({ ...current, [field]: value }))
  const updateAnimal = (
    index: number,
    field: keyof LetterDraft['animals'][number],
    value: string,
  ) =>
    setDraft((current) => ({
      ...current,
      animals: current.animals.map((animal, itemIndex) =>
        itemIndex === index ? { ...animal, [field]: value } : animal,
      ),
    }))
  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (!draft.signatureConfirmed) {
      setError('Confirma que firmas la carta de porte antes de continuar.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await onCreate(draft)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido guardar la carta.')
    } finally {
      setSaving(false)
    }
  }
  function selectRoute(routeId: string) {
    const route = routes.find((item) => item.id === routeId)
    const template = templates.find((item) => item.id === route?.templateId)
    const routeStopNames = new Set(
      (
        route?.stops?.map((stop) => stop.locality) ??
        template?.stops.map((stop) => stop.locality) ??
        []
      ).map((stop) => stop.toLocaleLowerCase()),
    )
    setDraft((current) => ({
      ...current,
      routeId,
      origin: routeStopNames.has(current.origin.toLocaleLowerCase()) ? current.origin : '',
      destination: routeStopNames.has(current.destination.toLocaleLowerCase())
        ? current.destination
        : '',
    }))
  }
  async function addStop(values: StopFormValues) {
    if (!selectedRoute || !addingStopFor) throw new Error('Selecciona primero una ruta diaria.')
    const stop = await onAddStop(selectedRoute.id, values)
    update(addingStopFor, stop.locality)
    setAddingStopFor(null)
  }
  function nextStep() {
    if (!formRef.current?.reportValidity()) return
    if (step === 2 && !draft.accompanyingDocuments.length) {
      setError('Selecciona al menos un documento que acompañe al animal.')
      return
    }
    setError('')
    setStep((current) => Math.min(current + 1, 3))
  }
  const updateAnimalCount = (count: number) =>
    setDraft((current) => ({
      ...current,
      animals: Array.from(
        { length: Math.max(1, Math.min(12, count || 1)) },
        (_, index) => current.animals[index] ?? emptyAnimal(),
      ),
    }))
  return (
    <>
      <OperationDialog
        title={isEditing ? 'Editar carta de porte' : 'Nueva carta de porte'}
        description="Te guiaremos paso a paso. Los datos se revisan antes de firmar y guardar."
        icon={isEditing ? <FilePenLine size={24} /> : <FilePlus2 size={24} />}
        onClose={onClose}
        wide
      >
        <form ref={formRef} className="letter-form" onSubmit={submit}>
          <FormProgress step={step} />
          {step === 0 && (
            <>
              <TripSection
                draft={draft}
                routes={routes}
                templates={templates}
                selectedRoute={selectedRoute}
                stops={stops}
                update={update}
                onRouteChange={selectRoute}
                onAddStop={setAddingStopFor}
                lockReference={isEditing}
              />
              <TripPointsSection draft={draft} update={update} />
            </>
          )}
          {step === 1 && (
            <>
              <ContactsSection draft={draft} update={update} />
              <ContactDetailsSection draft={draft} update={update} />
            </>
          )}
          {step === 2 && (
            <>
              <label className="animal-count">
                Número de animales
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={draft.animals.length}
                  onChange={(event) => updateAnimalCount(Number(event.target.value))}
                  required
                />
              </label>
              <AnimalsSection
                animals={draft.animals}
                updateAnimal={updateAnimal}
                onAdd={() => updateAnimalCount(draft.animals.length + 1)}
                onRemove={(index) =>
                  setDraft((current) => ({
                    ...current,
                    animals: current.animals.filter((_, itemIndex) => itemIndex !== index),
                  }))
                }
              />
              <DocumentsSection
                documents={draft.accompanyingDocuments}
                onChange={(documents) =>
                  setDraft((current) => ({ ...current, accompanyingDocuments: documents }))
                }
              />
            </>
          )}
          {step === 3 && (
            <BillingAndSignatureSection
              draft={draft}
              update={update}
              onOtherPayerChange={(field, value) =>
                setDraft((current) => ({
                  ...current,
                  otherPayer: { ...current.otherPayer, [field]: value },
                }))
              }
            />
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="letter-form-actions">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError('')
                  setStep((current) => current - 1)
                }}
              >
                <ArrowLeft /> Atrás
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" onClick={nextStep}>
                Continuar <ArrowRight />
              </Button>
            ) : (
              <Button type="submit" disabled={saving}>
                <ShieldCheck />{' '}
                {saving
                  ? 'Guardando carta…'
                  : isEditing
                    ? 'Firmar y guardar cambios'
                    : 'Firmar y crear carta'}
              </Button>
            )}
          </div>
        </form>
      </OperationDialog>
      {addingStopFor && <StopFormDialog onClose={() => setAddingStopFor(null)} onAdd={addStop} />}
    </>
  )
}

function TripSection({
  draft,
  routes,
  templates,
  selectedRoute,
  stops,
  update,
  onRouteChange,
  onAddStop,
  lockReference,
}: {
  draft: LetterDraft
  routes: DailyRoute[]
  templates: RouteTemplate[]
  selectedRoute?: DailyRoute
  stops: string[]
  update: <K extends Exclude<keyof LetterDraft, 'animals'>>(field: K, value: LetterDraft[K]) => void
  onRouteChange: (routeId: string) => void
  onAddStop: (field: 'origin' | 'destination') => void
  lockReference: boolean
}) {
  const template = templates.find((item) => item.id === selectedRoute?.templateId)
  const selectStop = (field: 'origin' | 'destination', value: string) =>
    value === '__new-stop__' ? onAddStop(field) : update(field, value)
  return (
    <section className="letter-form-section">
      <div className="letter-form-section-title">
        <MapPin size={17} />
        <div>
          <h3>¿Dónde se realiza el servicio?</h3>
          <p>Selecciona la ruta y los dos puntos del trayecto.</p>
        </div>
      </div>
      <div className="letter-form-grid">
        <Label className="form-span">
          Ruta diaria
          <select
            value={draft.routeId}
            onChange={(event) => onRouteChange(event.target.value)}
            required
          >
            <option value="">Selecciona una ruta…</option>
            {routes.map((route) => (
              <option value={route.id} key={route.id}>
                {templates.find((item) => item.id === route.templateId)?.name ??
                  'Ruta sin plantilla'}{' '}
                ·{' '}
                {new Date(`${route.date}T12:00:00`).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                })}
              </option>
            ))}
          </select>
        </Label>
        <Label>
          Número de carta
          <Input
            value={draft.reference}
            onChange={(event) => update('reference', event.target.value)}
            placeholder="Se asigna automáticamente"
            disabled={lockReference}
          />
        </Label>
        <p className="field-help">
          {lockReference
            ? 'La referencia no se puede cambiar una vez creada.'
            : 'Puedes dejarlo vacío si no tienes una referencia.'}
        </p>
      </div>
      {selectedRoute && (
        <div className="route-guidance" role="status">
          <strong>{template?.name}</strong>
          <span>Paradas de esta ruta: {stops.join(' · ')}</span>
        </div>
      )}
      <div className="letter-form-grid">
        <Label>
          Origen
          <select
            value={draft.origin}
            onChange={(event) => selectStop('origin', event.target.value)}
            disabled={!selectedRoute}
            required
          >
            <option value="">Selecciona una parada…</option>
            {stops.map((stop) => (
              <option value={stop} key={stop}>
                {stop}
              </option>
            ))}
            <option value="__new-stop__">+ Añadir nueva parada…</option>
          </select>
        </Label>
        <Label>
          Destino
          <select
            value={draft.destination}
            onChange={(event) => selectStop('destination', event.target.value)}
            disabled={!selectedRoute}
            required
          >
            <option value="">Selecciona una parada…</option>
            {stops.map((stop) => (
              <option value={stop} key={stop}>
                {stop}
              </option>
            ))}
            <option value="__new-stop__">+ Añadir nueva parada…</option>
          </select>
        </Label>
      </div>
    </section>
  )
}

type LetterUpdate = <K extends Exclude<keyof LetterDraft, 'animals'>>(
  field: K,
  value: LetterDraft[K],
) => void

function FormProgress({ step }: { step: number }) {
  const steps = ['Ruta y puntos', 'Personas', 'Animales', 'Pago y firma']
  return (
    <ol className="form-progress" aria-label="Progreso de la carta de porte">
      {steps.map((label, index) => (
        <li
          className={index === step ? 'is-active' : index < step ? 'is-complete' : ''}
          key={label}
        >
          <span>{index < step ? <Check size={13} /> : index + 1}</span>
          <strong>{label}</strong>
        </li>
      ))}
    </ol>
  )
}

function TripPointsSection({ draft, update }: { draft: LetterDraft; update: LetterUpdate }) {
  return (
    <section className="letter-form-section trip-points-section">
      <div className="letter-form-section-title">
        <MapPin size={17} />
        <div>
          <h3>Puntos exactos de recogida y entrega</h3>
          <p>Indica la dirección o referencia concreta, aparte de las paradas de la ruta.</p>
        </div>
      </div>
      <div className="letter-form-grid">
        <Label>
          Recogida: dirección o punto
          <Input
            value={draft.originPoint}
            onChange={(event) => update('originPoint', event.target.value)}
            placeholder="Ej. Calle Mayor 15, portal B"
            autoComplete="street-address"
            required
          />
        </Label>
        <Label>
          Entrega: dirección o punto
          <Input
            value={draft.destinationPoint}
            onChange={(event) => update('destinationPoint', event.target.value)}
            placeholder="Ej. Clínica Veterinaria Norte"
            autoComplete="street-address"
            required
          />
        </Label>
      </div>
    </section>
  )
}

export type StopFormValues = Omit<DailyRouteStop, 'id' | 'kind' | 'mapUrl'>

export function StopFormDialog({
  initialStop,
  insertionIndex,
  stopCount,
  onInsertionIndexChange,
  onClose,
  onAdd,
}: {
  initialStop?: DailyRouteStop
  insertionIndex?: number
  stopCount?: number
  onInsertionIndexChange?: (index: number) => void
  onClose: () => void
  onAdd: (stop: StopFormValues) => Promise<void>
}) {
  const [locality, setLocality] = useState(initialStop?.locality ?? '')
  const [postalCode, setPostalCode] = useState(initialStop?.postalCode ?? '')
  const [province, setProvince] = useState(initialStop?.province ?? '')
  const [country, setCountry] = useState(initialStop?.country ?? 'España')
  const [street, setStreet] = useState(initialStop?.street ?? '')
  const [streetNumber, setStreetNumber] = useState(initialStop?.streetNumber ?? '')
  const [addressQuery, setAddressQuery] = useState(() =>
    [initialStop?.street, initialStop?.streetNumber, initialStop?.postalCode, initialStop?.locality]
      .filter(Boolean)
      .join(', '),
  )
  const [floor, setFloor] = useState(initialStop?.floor ?? '')
  const [alias, setAlias] = useState(initialStop?.alias ?? '')
  const [place, setPlace] = useState(initialStop?.place ?? '')
  const [dwellMinutes, setDwellMinutes] = useState(String(initialStop?.dwellMinutes ?? 15))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [addressLookupState, setAddressLookupState] = useState<
    'idle' | 'searching' | 'empty' | 'failed'
  >('idle')
  const selectedAddressQuery = useRef('')
  const lookingUpAddress = addressLookupState === 'searching'
  useEffect(() => {
    const query = addressQuery.trim()
    if (query.length < 5 || query === selectedAddressQuery.current) {
      setAddressSuggestions([])
      setAddressLookupState('idle')
      return
    }
    const controller = new AbortController()
    let cancelled = false
    setAddressLookupState('searching')
    setAddressSuggestions([])
    const timer = window.setTimeout(() => {
      lookupAddressSuggestions(query, controller.signal)
        .then((suggestions) => {
          if (cancelled) return
          setAddressSuggestions(suggestions)
          setAddressLookupState(suggestions.length ? 'idle' : 'empty')
        })
        .catch((reason: unknown) => {
          if (cancelled || (reason instanceof DOMException && reason.name === 'AbortError')) return
          setAddressLookupState('failed')
        })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [addressQuery])
  function updateAddressQuery(value: string) {
    selectedAddressQuery.current = ''
    setAddressQuery(value)
  }
  function selectAddress(suggestion: AddressSuggestion) {
    const selectedAddress = [
      suggestion.street,
      suggestion.streetNumber,
      suggestion.postalCode,
      suggestion.locality,
    ]
      .filter(Boolean)
      .join(', ')
    selectedAddressQuery.current = selectedAddress
    setAddressQuery(selectedAddress)
    setStreet(suggestion.street)
    setStreetNumber(suggestion.streetNumber)
    setAlias(suggestion.alias)
    setLocality(suggestion.locality)
    setPostalCode(suggestion.postalCode)
    setProvince(suggestion.province)
    setCountry(suggestion.country)
    setAddressSuggestions([])
    setAddressLookupState('idle')
  }
  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onAdd({
        locality: locality.trim(),
        postalCode: postalCode.trim(),
        province: province.trim(),
        country: country.trim() || 'España',
        street: street.trim(),
        streetNumber: streetNumber.trim(),
        floor: floor.trim(),
        alias: alias.trim(),
        place: place.trim(),
        dwellMinutes: Math.max(0, Number(dwellMinutes) || 0),
        minutes: 0,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido añadir la parada.')
    } finally {
      setSaving(false)
    }
  }
  const editing = Boolean(initialStop)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="dialog-card !w-[calc(100%-2.5rem)] !max-w-[590px] !p-[26px]">
        <DialogHeader className="gap-0">
          <DialogTitle>{editing ? 'Editar parada' : 'Añadir parada'}</DialogTitle>
          <DialogDescription>
            Busca primero la dirección completa. Al elegir una coincidencia completaremos el resto;
            si no aparece, puedes rellenarlo manualmente.
          </DialogDescription>
        </DialogHeader>
        <form className="client-form" onSubmit={submit}>
          <div className="street-field form-span" aria-busy={lookingUpAddress}>
            <Label>
              Buscar dirección
              <Input
                value={addressQuery}
                onChange={(event) => updateAddressQuery(event.target.value)}
                placeholder="Ej. Calle Mayor 12, Madrid"
                autoComplete="street-address"
                autoFocus
              />
            </Label>
            {lookingUpAddress && (
              <p className="address-lookup-status" role="status">
                Buscando la dirección… espera antes de completar los demás campos.
              </p>
            )}
            {addressLookupState === 'empty' && (
              <p className="address-lookup-status" role="status">
                No hemos encontrado esa dirección. Puedes completar los campos manualmente.
              </p>
            )}
            {addressLookupState === 'failed' && (
              <p className="address-lookup-status" role="status">
                No se ha podido comprobar la dirección. Puedes completar los campos manualmente.
              </p>
            )}
            {addressSuggestions.length > 0 && (
              <div
                className="street-suggestions"
                role="listbox"
                aria-label="Direcciones disponibles"
              >
                {addressSuggestions.map((suggestion) => (
                  <button
                    type="button"
                    role="option"
                    key={`${suggestion.street}-${suggestion.streetNumber}-${suggestion.alias}-${suggestion.postalCode}`}
                    onClick={() => selectAddress(suggestion)}
                  >
                    <strong>
                      {suggestion.street}
                      {suggestion.streetNumber ? `, ${suggestion.streetNumber}` : ''}
                    </strong>
                    <span>
                      {[
                        suggestion.alias,
                        suggestion.locality,
                        suggestion.postalCode,
                        suggestion.province,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Label>
            Vía / calle
            <Input
              value={street}
              onChange={(event) => setStreet(event.target.value)}
              disabled={lookingUpAddress}
              required
            />
          </Label>
          <Label>
            Número
            <Input
              value={streetNumber}
              onChange={(event) => setStreetNumber(event.target.value)}
              disabled={lookingUpAddress}
              required
            />
          </Label>
          <Label>
            Código postal
            <Input
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, '').slice(0, 5))}
              inputMode="numeric"
              disabled={lookingUpAddress}
              required
            />
          </Label>
          <Label>
            Localidad
            <Input
              value={locality}
              onChange={(event) => setLocality(event.target.value)}
              disabled={lookingUpAddress}
              required
            />
          </Label>
          <Label>
            Provincia
            <Input
              value={province}
              onChange={(event) => setProvince(event.target.value)}
              disabled={lookingUpAddress}
              required
            />
          </Label>
          <Label>
            País
            <Input
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              disabled={lookingUpAddress}
              required
            />
          </Label>
          <Label>
            Alias o negocio
            <Input
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              disabled={lookingUpAddress}
              placeholder="Ej. Repsol Norte"
            />
          </Label>
          <Label>
            Piso, portal o local
            <Input
              value={floor}
              onChange={(event) => setFloor(event.target.value)}
              disabled={lookingUpAddress}
              placeholder="Opcional"
            />
          </Label>
          <Label className="form-span">
            Indicaciones o punto de encuentro
            <Input
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              disabled={lookingUpAddress}
              placeholder="Ej. aparcamiento lateral"
            />
          </Label>
          <Label>
            Espera en la parada (min)
            <Input
              type="number"
              min="0"
              step="5"
              value={dwellMinutes}
              onChange={(event) => setDwellMinutes(event.target.value)}
              disabled={lookingUpAddress}
            />
          </Label>
          {typeof insertionIndex === 'number' && onInsertionIndexChange && (
            <Label className="form-span">
              Posición en la ruta
              <select
                value={insertionIndex}
                onChange={(event) => onInsertionIndexChange(Number(event.target.value))}
              >
                {Array.from({ length: (stopCount ?? 0) + 1 }, (_, index) => (
                  <option key={index} value={index}>
                    Posición {index + 1}
                    {index === 0 ? ' · al inicio' : index === stopCount ? ' · al final' : ''}
                  </option>
                ))}
              </select>
            </Label>
          )}
          {error && (
            <p className="form-error form-span" role="alert">
              {error}
            </p>
          )}
          <Button
            className="dialog-submit form-span"
            type="submit"
            disabled={saving || lookingUpAddress}
          >
            <Pencil /> {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Añadir parada'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function NewTemplateDialog({
  onClose,
  onCreate,
  template,
  onUpdate,
}: {
  onClose: () => void
  onCreate: (name: string, color: string) => Promise<void>
  template?: RouteTemplate
  onUpdate?: (templateId: string, name: string, color: string) => Promise<void>
}) {
  const editing = Boolean(template)
  const [name, setName] = useState(template?.name ?? '')
  const [color, setColor] = useState(template?.color ?? '#2a4227')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (template && onUpdate) await onUpdate(template.id, name, color)
      else await onCreate(name, color)
      onClose()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : editing
            ? 'No se ha podido actualizar la ruta.'
            : 'No se ha podido crear la ruta.',
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <OperationDialog
      title={editing ? 'Editar ruta preestablecida' : 'Nueva ruta preestablecida'}
      description={
        editing
          ? 'Actualiza el nombre o color sin modificar sus paradas.'
          : 'Crea una ruta vacía y añade sus paradas en el orden en que se recorrerán.'
      }
      icon={<Route size={24} />}
      onClose={onClose}
    >
      <form className="client-form" onSubmit={submit}>
        <Label className="form-span">
          Nombre de la ruta
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Levante"
            autoFocus
            required
          />
        </Label>
        <Label>
          Color identificativo
          <Input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </Label>
        {error && (
          <p className="form-error form-span" role="alert">
            {error}
          </p>
        )}
        <Button className="dialog-submit form-span" type="submit" disabled={saving}>
          <Route />{' '}
          {saving
            ? editing
              ? 'Guardando…'
              : 'Creando…'
            : editing
              ? 'Guardar cambios'
              : 'Crear ruta'}
        </Button>
      </form>
    </OperationDialog>
  )
}

function ContactsSection({ draft, update }: { draft: LetterDraft; update: LetterUpdate }) {
  return (
    <section className="letter-form-section">
      <div className="letter-form-section-title">
        <UserRound size={17} />
        <div>
          <h3>Personas de contacto</h3>
          <p>Usaremos estos teléfonos para la recogida y la entrega.</p>
        </div>
      </div>
      <div className="people-grid">
        <fieldset>
          <legend>Quien entrega</legend>
          <Label>
            Nombre y apellidos
            <Input
              value={draft.sender}
              onChange={(event) => update('sender', event.target.value)}
              autoComplete="name"
              required
            />
          </Label>
          <Label>
            Teléfono
            <Input
              type="tel"
              value={draft.senderPhone}
              onChange={(event) => update('senderPhone', event.target.value)}
              autoComplete="tel"
              inputMode="tel"
              required
            />
          </Label>
        </fieldset>
        <fieldset>
          <legend>Quien recibe</legend>
          <Label>
            Nombre y apellidos
            <Input
              value={draft.recipient}
              onChange={(event) => update('recipient', event.target.value)}
              autoComplete="name"
              required
            />
          </Label>
          <Label>
            Teléfono
            <Input
              type="tel"
              value={draft.recipientPhone}
              onChange={(event) => update('recipientPhone', event.target.value)}
              autoComplete="tel"
              inputMode="tel"
              required
            />
          </Label>
        </fieldset>
      </div>
    </section>
  )
}

function ContactDetailsSection({ draft, update }: { draft: LetterDraft; update: LetterUpdate }) {
  const updatePerson = (
    person: 'sender' | 'recipient',
    field: 'Nif' | 'Email' | 'Address' | 'PostalCode' | 'City' | 'Province',
    value: string,
  ) => update(`${person}${field}` as Exclude<keyof LetterDraft, 'animals'>, value)
  return (
    <section className="letter-form-section">
      <div className="letter-form-section-title">
        <UserRound size={17} />
        <div>
          <h3>Datos completos de las personas</h3>
          <p>Los necesitamos para identificar el servicio y preparar la factura.</p>
        </div>
      </div>
      <div className="people-grid">
        <ContactDetails
          title="Datos del remitente"
          person="sender"
          draft={draft}
          onChange={updatePerson}
        />
        <ContactDetails
          title="Datos del destinatario"
          person="recipient"
          draft={draft}
          onChange={updatePerson}
        />
      </div>
    </section>
  )
}

function ContactDetails({
  title,
  person,
  draft,
  onChange,
}: {
  title: string
  person: 'sender' | 'recipient'
  draft: LetterDraft
  onChange: (
    person: 'sender' | 'recipient',
    field: 'Nif' | 'Email' | 'Address' | 'PostalCode' | 'City' | 'Province',
    value: string,
  ) => void
}) {
  const value = (field: 'Nif' | 'Email' | 'Address' | 'PostalCode' | 'City' | 'Province') =>
    draft[`${person}${field}` as keyof LetterDraft] as string
  return (
    <fieldset className="contact-details">
      <legend>{title}</legend>
      <Label>
        DNI / NIF
        <Input
          value={value('Nif')}
          onChange={(event) => onChange(person, 'Nif', event.target.value)}
          required
        />
      </Label>
      <Label>
        Email
        <Input
          type="email"
          value={value('Email')}
          onChange={(event) => onChange(person, 'Email', event.target.value)}
          autoComplete="email"
          required
        />
      </Label>
      <Label className="form-span">
        Dirección
        <Input
          value={value('Address')}
          onChange={(event) => onChange(person, 'Address', event.target.value)}
          autoComplete="street-address"
          required
        />
      </Label>
      <Label>
        Código postal
        <Input
          value={value('PostalCode')}
          onChange={(event) => onChange(person, 'PostalCode', event.target.value)}
          autoComplete="postal-code"
          inputMode="numeric"
          required
        />
      </Label>
      <Label>
        Municipio
        <Input
          value={value('City')}
          onChange={(event) => onChange(person, 'City', event.target.value)}
          autoComplete="address-level2"
          required
        />
      </Label>
      <Label className="form-span">
        Provincia <small>Opcional</small>
        <Input
          value={value('Province')}
          onChange={(event) => onChange(person, 'Province', event.target.value)}
          autoComplete="address-level1"
        />
      </Label>
    </fieldset>
  )
}

function AnimalsSection({
  animals,
  updateAnimal,
  onAdd,
  onRemove,
}: {
  animals: LetterDraft['animals']
  updateAnimal: (index: number, field: keyof LetterDraft['animals'][number], value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  return (
    <section className="letter-form-section">
      <div className="letter-form-section-title">
        <PawPrint size={17} />
        <div>
          <h3>Mascotas que viajan</h3>
          <p>Completa una ficha por animal. El tamaño ayuda a asignar el box.</p>
        </div>
      </div>
      <div className="animal-list">
        {animals.map((animal, index) => (
          <article className="animal-form-card" key={index}>
            <div>
              <strong>Animal {index + 1}</strong>
              {animals.length > 1 && (
                <Button variant="ghost" size="sm" type="button" onClick={() => onRemove(index)}>
                  <Trash2 size={16} /> Quitar
                </Button>
              )}
            </div>
            <div className="letter-form-grid animal-fields">
              <Label>
                Especie
                <select
                  value={animal.species}
                  onChange={(event) => updateAnimal(index, 'species', event.target.value)}
                  required
                >
                  <option>Canina</option>
                  <option>Felina</option>
                  <option>Ave</option>
                  <option>Otro</option>
                </select>
              </Label>
              <Label>
                Raza
                <Input
                  value={animal.breed}
                  onChange={(event) => updateAnimal(index, 'breed', event.target.value)}
                  placeholder="Ej. Labrador"
                  required
                />
              </Label>
              <Label>
                Fecha de nacimiento
                <Input
                  type="date"
                  value={animal.birthDate}
                  onChange={(event) => updateAnimal(index, 'birthDate', event.target.value)}
                  required
                />
              </Label>
            </div>
            <fieldset className="size-selector">
              <legend>Tamaño aproximado</legend>
              <div>
                {(
                  [
                    ['pequeno', 'Pequeño'],
                    ['mediano', 'Mediano'],
                    ['grande', 'Grande'],
                  ] as const
                ).map(([size, label]) => (
                  <label className={animal.size === size ? 'is-selected' : ''} key={size}>
                    <input
                      type="radio"
                      name={`animal-size-${index}`}
                      checked={animal.size === size}
                      onChange={() => updateAnimal(index, 'size', size)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </article>
        ))}
      </div>
      <Button
        variant="outline"
        type="button"
        className="add-animal"
        onClick={onAdd}
        disabled={animals.length >= 12}
      >
        <Plus size={17} /> Añadir otro animal
      </Button>
    </section>
  )
}

const accompanyingDocumentOptions: Array<[AccompanyingDocument, string]> = [
  ['cartilla_sanitaria', 'Cartilla sanitaria'],
  ['microchip', 'Microchip'],
  ['pasaporte', 'Pasaporte'],
  ['tatuaje', 'Tatuaje'],
  ['anillo', 'Anillo'],
  ['cites', 'CITES'],
  ['otro', 'Otro'],
]

function DocumentsSection({
  documents,
  onChange,
}: {
  documents: AccompanyingDocument[]
  onChange: (documents: AccompanyingDocument[]) => void
}) {
  const toggle = (document: AccompanyingDocument) =>
    onChange(
      documents.includes(document)
        ? documents.filter((item) => item !== document)
        : [...documents, document],
    )
  return (
    <section className="letter-form-section">
      <div className="letter-form-section-title">
        <FilePenLine size={17} />
        <div>
          <h3>Documentación que acompaña</h3>
          <p>Marca todo lo que viaja con los animales.</p>
        </div>
      </div>
      <div className="document-checks">
        {accompanyingDocumentOptions.map(([value, label]) => (
          <label className={documents.includes(value) ? 'is-selected' : ''} key={value}>
            <input
              type="checkbox"
              checked={documents.includes(value)}
              onChange={() => toggle(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </section>
  )
}

function BillingAndSignatureSection({
  draft,
  update,
  onOtherPayerChange,
}: {
  draft: LetterDraft
  update: LetterUpdate
  onOtherPayerChange: (field: keyof InvoiceClientInput, value: string) => void
}) {
  const payerLabels: Record<InvoicePayer, [string, string]> = {
    remitente: ['Remitente', draft.sender || 'Datos del remitente'],
    destinatario: ['Destinatario', draft.recipient || 'Datos del destinatario'],
    manual: ['Empresa u otro', 'Indicar datos fiscales'],
  }
  return (
    <>
      <section className="letter-form-section">
        <div className="letter-form-section-title">
          <CreditCard size={17} />
          <div>
            <h3>¿Quién paga el servicio?</h3>
            <p>Estos datos se usarán al preparar la factura.</p>
          </div>
        </div>
        <div
          className="payer-options letter-payer-options"
          role="radiogroup"
          aria-label="Persona que paga el servicio"
        >
          {(Object.keys(payerLabels) as InvoicePayer[]).map((payer) => (
            <button
              type="button"
              role="radio"
              aria-checked={draft.billingPayer === payer}
              className={draft.billingPayer === payer ? 'is-selected' : ''}
              key={payer}
              onClick={() => update('billingPayer', payer)}
            >
              <span>{payerLabels[payer][0]}</span>
              <strong>{payerLabels[payer][1]}</strong>
            </button>
          ))}
        </div>
        {draft.billingPayer === 'manual' && (
          <div className="client-form invoice-client-form">
            <Label className="form-span">
              Nombre o razón social
              <Input
                value={draft.otherPayer.fullName}
                onChange={(event) => onOtherPayerChange('fullName', event.target.value)}
                required
              />
            </Label>
            <Label>
              NIF / CIF
              <Input
                value={draft.otherPayer.nif}
                onChange={(event) => onOtherPayerChange('nif', event.target.value)}
                required
              />
            </Label>
            <Label>
              Email
              <Input
                type="email"
                value={draft.otherPayer.email}
                onChange={(event) => onOtherPayerChange('email', event.target.value)}
                required
              />
            </Label>
            <Label>
              Teléfono
              <Input
                type="tel"
                value={draft.otherPayer.phone}
                onChange={(event) => onOtherPayerChange('phone', event.target.value)}
                required
              />
            </Label>
            <Label className="form-span">
              Dirección fiscal
              <Input
                value={draft.otherPayer.address}
                onChange={(event) => onOtherPayerChange('address', event.target.value)}
                required
              />
            </Label>
            <Label>
              Código postal
              <Input
                value={draft.otherPayer.postalCode}
                onChange={(event) => onOtherPayerChange('postalCode', event.target.value)}
                required
              />
            </Label>
            <Label>
              Municipio
              <Input
                value={draft.otherPayer.city}
                onChange={(event) => onOtherPayerChange('city', event.target.value)}
                required
              />
            </Label>
          </div>
        )}
      </section>
      <section className="letter-form-section signature-section">
        <div className="letter-form-section-title">
          <ShieldCheck size={17} />
          <div>
            <h3>Firma y confirmación</h3>
            <p>Revisa los datos antes de finalizar.</p>
          </div>
        </div>
        <label className="signature-confirmation">
          <input
            type="checkbox"
            checked={draft.signatureConfirmed}
            onChange={(event) => update('signatureConfirmed', event.target.checked)}
          />
          <span>Confirmo que la información es correcta y firmo esta carta de porte.</span>
        </label>
      </section>
    </>
  )
}

export function NewRouteDirectionDialog({
  templates,
  transporters,
  onClose,
  onCreate,
}: {
  templates: RouteTemplate[]
  transporters: Transporter[]
  onClose: () => void
  onCreate: (
    template: RouteTemplate,
    date: string,
    transporterId?: string,
    direction?: RouteDirection,
  ) => Promise<void>
}) {
  const [date, setDate] = useState('')
  const [transporterId, setTransporterId] = useState('')
  const [direction, setDirection] = useState<RouteDirection>('normal')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const directionLabel = direction === 'normal' ? 'sentido habitual' : 'sentido inverso'
  async function create(template: RouteTemplate) {
    const minimumDate = todayIso()
    if (!date) return setError('Selecciona la fecha de servicio.')
    if (date < minimumDate) return setError('La fecha de servicio no puede ser anterior a hoy.')
    setSaving(true)
    setError('')
    try {
      await onCreate(template, date, transporterId || undefined, direction)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido crear la ruta.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <OperationDialog
      title="Crear ruta diaria"
      description="Elige primero la fecha y hacia dónde recorrerás la ruta. Las paradas se crearán ya en ese orden."
      icon={<Route size={24} />}
      onClose={onClose}
    >
      <Label className="date-field">
        Fecha de servicio
        <Input
          type="date"
          min={todayIso()}
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </Label>
      <div className="direction-field">
        <span>Sentido de la ruta</span>
        <div className="route-direction-options" role="radiogroup" aria-label="Sentido de la ruta">
          <button
            type="button"
            role="radio"
            aria-checked={direction === 'normal'}
            className={direction === 'normal' ? 'is-selected' : ''}
            onClick={() => setDirection('normal')}
          >
            <ArrowRight />
            <strong>Habitual</strong>
            <small>Como está guardada la ruta</small>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={direction === 'inversa'}
            className={direction === 'inversa' ? 'is-selected' : ''}
            onClick={() => setDirection('inversa')}
          >
            <ArrowLeft />
            <strong>Inverso</strong>
            <small>Las mismas paradas al revés</small>
          </button>
        </div>
        <p>
          Crearás la ruta en <strong>{directionLabel}</strong>.
        </p>
      </div>
      <Label className="date-field">
        Asignar a transportista
        <select value={transporterId} onChange={(event) => setTransporterId(event.target.value)}>
          <option value="">Sin asignar</option>
          {transporters.map((transporter) => (
            <option value={transporter.id} key={transporter.id}>
              {transporter.displayName}
            </option>
          ))}
        </select>
      </Label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-options">
        {templates.map((template) => (
          <button
            type="button"
            key={template.id}
            disabled={saving}
            onClick={() => void create(template)}
          >
            <span className="template-dot" style={{ background: template.color }} />
            <span>
              <strong>{template.name}</strong>
              <small>
                {template.stops.length} paradas · {directionLabel}
              </small>
            </span>
            <ChevronRight size={17} />
          </button>
        ))}
      </div>
    </OperationDialog>
  )
}

/* Previous invoice dialog implementations:
export function InvoiceDialog({ letter, onClose, onGenerate }: { letter: Letter; onClose: () => void; onGenerate: (letter: Letter, payer: InvoicePayer, total: number, manualClient?: InvoiceClientInput, delivery?: PaymentDelivery) => Promise<void> }) {
  const [payer, setPayer] = useState<InvoicePayer>('remitente'); const [total, setTotal] = useState('200'); const [generating, setGenerating] = useState(false); const [manualClient, setManualClient] = useState<InvoiceClientInput>(emptyInvoiceClient); const [deliveryChannel, setDeliveryChannel] = useState<PaymentDeliveryChannel>('manual'); const [deliveryEmail, setDeliveryEmail] = useState(letter.extractionEmail ?? ''); const [deliveryPhone, setDeliveryPhone] = useState(letter.senderPhone); const [error, setError] = useState('')
  const updateManualClient = (field: keyof InvoiceClientInput, value: string) => setManualClient((current) => ({ ...current, [field]: value })); const selectPayer = (nextPayer: InvoicePayer) => { setPayer(nextPayer); setError('') }
  const generate = async () => { if (payer === 'manual' && !manualClient.fullName.trim()) return setError('Indica la razón social o el nombre de la persona a facturar.'); if ((deliveryChannel === 'email' || deliveryChannel === 'both') && !deliveryEmail.trim()) return setError('Indica el email de entrega de la factura.'); if ((deliveryChannel === 'whatsapp' || deliveryChannel === 'both') && !deliveryPhone.trim()) return setError('Indica el móvil al que se enviará la factura por WhatsApp.'); setGenerating(true); try { await onGenerate(letter, payer, Number(total) || 0, payer === 'manual' ? manualClient : undefined, { channel: deliveryChannel, email: deliveryEmail, phone: deliveryPhone }); onClose() } catch (reason) { const message = reason instanceof Error ? reason.message : typeof reason === 'object' && reason && 'message' in reason && typeof reason.message === 'string' ? reason.message : 'No se ha podido generar la factura.'; setError(message) } finally { setGenerating(false) } }
  return <OperationDialog title="Generar factura" description="Genera la factura para este servicio. Puedes gestionar el envío manualmente o por un canal de entrega." icon={<Printer size={24} />} onClose={onClose}><div className="payer-options" role="radiogroup" aria-label="Titular de la factura"><button type="button" role="radio" aria-checked={payer === 'remitente'} className={payer === 'remitente' ? 'is-selected' : ''} onClick={() => { selectPayer('remitente'); setDeliveryPhone(letter.senderPhone) }}><span>Remitente</span><strong>{letter.sender}</strong></button><button type="button" role="radio" aria-checked={payer === 'destinatario'} className={payer === 'destinatario' ? 'is-selected' : ''} onClick={() => { selectPayer('destinatario'); setDeliveryPhone(letter.recipientPhone) }}><span>Destinatario</span><strong>{letter.recipient}</strong></button><button type="button" role="radio" aria-checked={payer === 'manual'} className={payer === 'manual' ? 'is-selected' : ''} onClick={() => selectPayer('manual')}><span>Empresa u otro</span><strong>Introducir datos</strong></button></div>{payer === 'manual' && <div className="client-form invoice-client-form"><Label className="form-span">Razón social o nombre<Input value={manualClient.fullName} onChange={(event) => updateManualClient('fullName', event.target.value)} required /></Label><Label>NIF / CIF<Input value={manualClient.nif} onChange={(event) => updateManualClient('nif', event.target.value)} /></Label><Label className="form-span">Dirección<Input value={manualClient.address} onChange={(event) => updateManualClient('address', event.target.value)} /></Label><Label>Código postal<Input value={manualClient.postalCode} onChange={(event) => updateManualClient('postalCode', event.target.value)} /></Label><Label>Ciudad<Input value={manualClient.city} onChange={(event) => updateManualClient('city', event.target.value)} /></Label></div>}<Label className="date-field">Total (IVA incluido)<Input type="number" min="0" step="0.01" value={total} onChange={(event) => setTotal(event.target.value)} /></Label><Label className="date-field">Enviar factura por<select value={deliveryChannel} onChange={(event) => setDeliveryChannel(event.target.value as PaymentDeliveryChannel)}><option value="manual">Manual</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="both">Email y WhatsApp</option></select></Label>{(deliveryChannel === 'email' || deliveryChannel === 'both') && <Label className="date-field">Email de entrega<Input type="email" value={deliveryEmail} onChange={(event) => setDeliveryEmail(event.target.value)} /></Label>}{(deliveryChannel === 'whatsapp' || deliveryChannel === 'both') && <Label className="date-field">Móvil con WhatsApp<Input type="tel" value={deliveryPhone} onChange={(event) => setDeliveryPhone(event.target.value)} /></Label>}{error && <p className="form-error" role="alert">{error}</p>}<Button className="dialog-submit" disabled={generating} onClick={generate}><Printer /> {generating ? 'Generando…' : 'Generar factura'}</Button></OperationDialog>
 * Parent version:
export function InvoiceDialog({ letter, onClose, onGenerate }: { letter: Letter; onClose: () => void; onGenerate: (letter: Letter, payer: InvoicePayer, total: number, manualClient?: InvoiceClientInput, delivery?: PaymentDelivery) => Promise<void> }) {
  const [payer, setPayer] = useState<InvoicePayer>('remitente'); const [total, setTotal] = useState('200'); const [generating, setGenerating] = useState(false); const [manualClient, setManualClient] = useState<InvoiceClientInput>(emptyInvoiceClient); const [deliveryChannel, setDeliveryChannel] = useState<PaymentDeliveryChannel>('manual'); const [deliveryEmail, setDeliveryEmail] = useState(letter.extractionEmail ?? ''); const [deliveryPhone, setDeliveryPhone] = useState(letter.senderPhone); const [error, setError] = useState('')
  const updateManualClient = (field: keyof InvoiceClientInput, value: string) => setManualClient((current) => ({ ...current, [field]: value })); const selectPayer = (nextPayer: InvoicePayer) => { setPayer(nextPayer); setError('') }
  const generate = async () => { if (payer === 'manual' && !manualClient.fullName.trim()) return setError('Indica la razón social o el nombre de la persona a facturar.'); if ((deliveryChannel === 'email' || deliveryChannel === 'both') && !deliveryEmail.trim()) return setError('Indica el email de entrega de la factura.'); if ((deliveryChannel === 'whatsapp' || deliveryChannel === 'both') && !deliveryPhone.trim()) return setError('Indica el móvil al que se enviará la factura por WhatsApp.'); setGenerating(true); try { await onGenerate(letter, payer, Number(total) || 0, payer === 'manual' ? manualClient : undefined, { channel: deliveryChannel, email: deliveryEmail, phone: deliveryPhone }); onClose() } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se ha podido generar la factura.') } finally { setGenerating(false) } }
  return <OperationDialog title="Generar factura" description="Genera la factura para este servicio. Puedes gestionar el envío manualmente o por un canal de entrega." icon={<Printer size={24} />} onClose={onClose}><div className="payer-options" role="radiogroup" aria-label="Titular de la factura"><button type="button" role="radio" aria-checked={payer === 'remitente'} className={payer === 'remitente' ? 'is-selected' : ''} onClick={() => { selectPayer('remitente'); setDeliveryPhone(letter.senderPhone) }}><span>Remitente</span><strong>{letter.sender}</strong></button><button type="button" role="radio" aria-checked={payer === 'destinatario'} className={payer === 'destinatario' ? 'is-selected' : ''} onClick={() => { selectPayer('destinatario'); setDeliveryPhone(letter.recipientPhone) }}><span>Destinatario</span><strong>{letter.recipient}</strong></button><button type="button" role="radio" aria-checked={payer === 'manual'} className={payer === 'manual' ? 'is-selected' : ''} onClick={() => selectPayer('manual')}><span>Empresa u otro</span><strong>Introducir datos</strong></button></div>{payer === 'manual' && <div className="client-form invoice-client-form"><Label className="form-span">Razón social o nombre<Input value={manualClient.fullName} onChange={(event) => updateManualClient('fullName', event.target.value)} required /></Label><Label>NIF / CIF<Input value={manualClient.nif} onChange={(event) => updateManualClient('nif', event.target.value)} /></Label><Label className="form-span">Dirección<Input value={manualClient.address} onChange={(event) => updateManualClient('address', event.target.value)} /></Label><Label>Código postal<Input value={manualClient.postalCode} onChange={(event) => updateManualClient('postalCode', event.target.value)} /></Label><Label>Ciudad<Input value={manualClient.city} onChange={(event) => updateManualClient('city', event.target.value)} /></Label></div>}<Label className="date-field">Total (IVA incluido)<Input type="number" min="0" step="0.01" value={total} onChange={(event) => setTotal(event.target.value)} /></Label><Label className="date-field">Enviar factura por<select value={deliveryChannel} onChange={(event) => setDeliveryChannel(event.target.value as PaymentDeliveryChannel)}><option value="manual">Manual</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="both">Email y WhatsApp</option></select></Label>{(deliveryChannel === 'email' || deliveryChannel === 'both') && <Label className="date-field">Email de entrega<Input type="email" value={deliveryEmail} onChange={(event) => setDeliveryEmail(event.target.value)} /></Label>}{(deliveryChannel === 'whatsapp' || deliveryChannel === 'both') && <Label className="date-field">Móvil con WhatsApp<Input type="tel" value={deliveryPhone} onChange={(event) => setDeliveryPhone(event.target.value)} /></Label>}{error && <p className="form-error" role="alert">{error}</p>}<Button className="dialog-submit" disabled={generating} onClick={generate}><Printer /> {generating ? 'Generando…' : 'Generar factura'}</Button></OperationDialog>
 */
export function InvoiceDialog({
  letter,
  onClose,
  onGenerate,
}: {
  letter: Letter
  onClose: () => void
  onGenerate: (
    letter: Letter,
    payer: InvoicePayer,
    total: number,
    client: InvoiceClientInput,
    delivery?: PaymentDelivery,
  ) => Promise<void>
}) {
  const payerClient = (nextPayer: InvoicePayer): InvoiceClientInput => {
    if (nextPayer === letter.billingPayer) return letter.billingClient
    if (nextPayer === 'manual') return emptyInvoiceClient()
    const sender = nextPayer === 'remitente'
    return {
      fullName: sender ? letter.sender : letter.recipient,
      nif: sender ? letter.senderNif : letter.recipientNif,
      email: sender ? letter.senderEmail : letter.recipientEmail,
      phone: sender ? letter.senderPhone : letter.recipientPhone,
      address: sender ? letter.senderAddress : letter.recipientAddress,
      city: sender ? letter.senderCity : letter.recipientCity,
      postalCode: sender ? letter.senderPostalCode : letter.recipientPostalCode,
    }
  }
  const [payer, setPayer] = useState<InvoicePayer>(letter.billingPayer)
  const [total, setTotal] = useState('200')
  const [generating, setGenerating] = useState(false)
  const [client, setClient] = useState<InvoiceClientInput>(() => payerClient(letter.billingPayer))
  const [deliveryChannel, setDeliveryChannel] = useState<PaymentDeliveryChannel>('manual')
  const [deliveryEmail, setDeliveryEmail] = useState(
    letter.billingClient.email || letter.extractionEmail || '',
  )
  const [deliveryPhone, setDeliveryPhone] = useState(
    letter.billingClient.phone || letter.senderPhone,
  )
  const [error, setError] = useState('')
  const updateClient = (field: keyof InvoiceClientInput, value: string) =>
    setClient((current) => ({ ...current, [field]: value }))
  const selectPayer = (nextPayer: InvoicePayer) => {
    const nextClient = payerClient(nextPayer)
    setPayer(nextPayer)
    setClient(nextClient)
    setDeliveryEmail(nextClient.email)
    setDeliveryPhone(nextClient.phone)
    setError('')
  }
  const generate = async () => {
    if ((deliveryChannel === 'email' || deliveryChannel === 'both') && !deliveryEmail.trim())
      return setError('Indica el email de entrega.')
    if ((deliveryChannel === 'whatsapp' || deliveryChannel === 'both') && !deliveryPhone.trim())
      return setError('Indica el móvil al que se enviará la factura por WhatsApp.')
    setGenerating(true)
    try {
      await onGenerate(letter, payer, Number(total), client, {
        channel: deliveryChannel,
        email: deliveryEmail,
        phone: deliveryPhone,
      })
      onClose()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se ha podido crear la solicitud de pago.',
      )
    } finally {
      setGenerating(false)
    }
  }
  return (
    <OperationDialog
      title="Crear solicitud de pago"
      description="La factura se emitirá y numerará al confirmar el cobro. Completa ahora los datos fiscales que quedarán congelados."
      icon={<Printer size={24} />}
      onClose={onClose}
    >
      <div className="payer-options" role="radiogroup" aria-label="Titular de la factura">
        <button
          type="button"
          role="radio"
          aria-checked={payer === 'remitente'}
          className={payer === 'remitente' ? 'is-selected' : ''}
          onClick={() => selectPayer('remitente')}
        >
          <span>Remitente</span>
          <strong>{letter.sender}</strong>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={payer === 'destinatario'}
          className={payer === 'destinatario' ? 'is-selected' : ''}
          onClick={() => selectPayer('destinatario')}
        >
          <span>Destinatario</span>
          <strong>{letter.recipient}</strong>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={payer === 'manual'}
          className={payer === 'manual' ? 'is-selected' : ''}
          onClick={() => selectPayer('manual')}
        >
          <span>Empresa u otro</span>
          <strong>Introducir datos</strong>
        </button>
      </div>
      <div className="client-form invoice-client-form">
        <Label className="form-span">
          Razón social o nombre
          <Input
            value={client.fullName}
            onChange={(event) => updateClient('fullName', event.target.value)}
            autoComplete="name"
            required
          />
        </Label>
        <Label>
          NIF / CIF
          <Input
            value={client.nif}
            onChange={(event) => updateClient('nif', event.target.value)}
            autoComplete="off"
            required
          />
        </Label>
        <Label className="form-span">
          Dirección fiscal
          <Input
            value={client.address}
            onChange={(event) => updateClient('address', event.target.value)}
            autoComplete="street-address"
            required
          />
        </Label>
        <Label>
          Código postal
          <Input
            value={client.postalCode}
            onChange={(event) => updateClient('postalCode', event.target.value)}
            autoComplete="postal-code"
            required
          />
        </Label>
        <Label>
          Ciudad
          <Input
            value={client.city}
            onChange={(event) => updateClient('city', event.target.value)}
            autoComplete="address-level2"
            required
          />
        </Label>
        <Label>
          Email de contacto
          <Input
            type="email"
            value={client.email}
            onChange={(event) => updateClient('email', event.target.value)}
            autoComplete="email"
          />
        </Label>
        <Label>
          Teléfono
          <Input
            type="tel"
            value={client.phone}
            onChange={(event) => updateClient('phone', event.target.value)}
            autoComplete="tel"
          />
        </Label>
      </div>
      <Label className="date-field">
        Total (IVA incluido)
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={total}
          onChange={(event) => setTotal(event.target.value)}
          required
        />
      </Label>
      <Label className="date-field">
        Enviar solicitud por
        <select
          value={deliveryChannel}
          onChange={(event) => setDeliveryChannel(event.target.value as PaymentDeliveryChannel)}
        >
          <option value="manual">Gestión manual</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="both">Email y WhatsApp</option>
        </select>
      </Label>
      {(deliveryChannel === 'email' || deliveryChannel === 'both') && (
        <Label className="date-field">
          Email de entrega
          <Input
            type="email"
            value={deliveryEmail}
            onChange={(event) => setDeliveryEmail(event.target.value)}
          />
        </Label>
      )}
      {(deliveryChannel === 'whatsapp' || deliveryChannel === 'both') && (
        <Label className="date-field">
          Móvil con WhatsApp
          <Input
            type="tel"
            value={deliveryPhone}
            onChange={(event) => setDeliveryPhone(event.target.value)}
          />
        </Label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button className="dialog-submit" disabled={generating} onClick={generate}>
        <Printer /> {generating ? 'Creando…' : 'Crear solicitud de pago'}
      </Button>
    </OperationDialog>
  )
}

export function NewRouteDialog({
  templates,
  transporters,
  onClose,
  onCreate,
}: {
  templates: RouteTemplate[]
  transporters: Transporter[]
  onClose: () => void
  onCreate: (template: RouteTemplate, date: string, transporterId?: string) => void
}) {
  const [date, setDate] = useState('')
  const [transporterId, setTransporterId] = useState('')
  return (
    <OperationDialog
      title="Crear ruta diaria"
      description="Se copiarán todas las paradas y se añadirán las recogidas y entregas compatibles con la fecha elegida."
      icon={<Route size={24} />}
      onClose={onClose}
    >
      <Label className="date-field">
        Fecha de servicio
        <Input
          type="date"
          min={todayIso()}
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </Label>
      <Label className="date-field">
        Asignar a transportista
        <select value={transporterId} onChange={(event) => setTransporterId(event.target.value)}>
          <option value="">Sin asignar</option>
          {transporters.map((transporter) => (
            <option value={transporter.id} key={transporter.id}>
              {transporter.displayName}
            </option>
          ))}
        </select>
      </Label>
      <div className="dialog-options">
        {templates.map((template) => (
          <button
            type="button"
            key={template.id}
            disabled={!date || date < todayIso()}
            onClick={() => onCreate(template, date, transporterId || undefined)}
          >
            <span className="template-dot" style={{ background: template.color }} />
            <span>
              <strong>{template.name}</strong>
              <small>{template.stops.length} paradas</small>
            </span>
            <ChevronRight size={17} />
          </button>
        ))}
      </div>
    </OperationDialog>
  )
}
