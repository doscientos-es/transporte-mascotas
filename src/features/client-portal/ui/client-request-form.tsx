import {
  Button,
  Card,
  CardContent,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@doscientos/ui'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  CreditCard,
  FileText,
  MapPin,
  PawPrint,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'

import {
  minimumTransportBoxCategory,
  requestedTransportBoxCategory,
  transportAnimalsTotalCents,
  transportBoxCategoryLabel,
  transportBoxCategoryRank,
  transportBoxOptions,
  transportBoxPriceCents,
  type TransportBoxCatalog,
} from '@/shared/application/transport-boxes'
import { DEFAULT_ROUTE_START_TIME } from '@/shared/constants/route-defaults'
import { routeDaysLabel, routeStopArrivals } from '@/shared/lib/route-days'
import type {
  AccompanyingDocument,
  InvoiceClientInput,
  InvoicePayer,
  RouteStop,
  TransportRequestAnimal,
  UpcomingRoute,
} from '@/shared/types'

import { findNearestPickupStop, getCurrentLocation } from '../application/nearest-route-stop'
import { payerIdentity } from '../application/request-payer'
import { approximateArrivalPeriod } from '../application/route-arrival-window'
import { transportLocationMapsUrl } from '../application/route-maps'
import {
  deliveryOptions,
  pickupOptions,
  routeSelectionError,
  suggestedPartyCities,
} from '../application/route-stop-options'

export type RequestFormValues = {
  contactName: string
  contactPhone: string
  contactEmail: string
  senderNif: string
  senderAddress: string
  senderPostalCode: string
  senderCity: string
  senderProvince: string
  recipientName: string
  recipientNif: string
  recipientPhone: string
  recipientEmail: string
  recipientAddress: string
  recipientPostalCode: string
  recipientCity: string
  recipientProvince: string
  billingPayer: InvoicePayer
  billingClient: InvoiceClientInput
  origin: string
  destination: string
  desiredDate: string
  dailyRouteId: string
  accompanyingDocuments: AccompanyingDocument[]
  notes: string
  animals: TransportRequestAnimal[]
}

type PartyField =
  | 'contactName'
  | 'contactPhone'
  | 'contactEmail'
  | 'senderNif'
  | 'senderAddress'
  | 'senderPostalCode'
  | 'senderCity'
  | 'senderProvince'
  | 'recipientName'
  | 'recipientNif'
  | 'recipientPhone'
  | 'recipientEmail'
  | 'recipientAddress'
  | 'recipientPostalCode'
  | 'recipientCity'
  | 'recipientProvince'

const steps = ['Trayecto', 'Contacto', 'Mascotas', 'Revisar']
const currency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
const emptyAnimal = (ordinal: number): TransportRequestAnimal => ({
  ordinal,
  name: '',
  species: '',
  breed: '',
  birthDate: '',
  weightKg: 0,
  lengthCm: 0,
  heightCm: 0,
  widthCm: 0,
})

const invoiceClient = (fullName = '', email = '', phone = '', nif = ''): InvoiceClientInput => ({
  fullName,
  nif,
  email,
  phone,
  address: '',
  city: '',
  postalCode: '',
})

const hasMeasurements = (animal: TransportRequestAnimal) =>
  animal.weightKg > 0 && animal.lengthCm > 0 && animal.heightCm > 0 && animal.widthCm > 0

const initialValues = (
  contactName: string,
  contactPhone: string,
  contactEmail: string,
  preselectedRoute?: UpcomingRoute,
): RequestFormValues => {
  const values: RequestFormValues = {
    contactName,
    contactPhone,
    contactEmail,
    senderNif: '',
    senderAddress: '',
    senderPostalCode: '',
    senderCity: '',
    senderProvince: '',
    recipientName: '',
    recipientNif: '',
    recipientPhone: '',
    recipientEmail: '',
    recipientAddress: '',
    recipientPostalCode: '',
    recipientCity: '',
    recipientProvince: '',
    billingPayer: 'remitente',
    billingClient: invoiceClient(),
    origin: '',
    destination: '',
    desiredDate: preselectedRoute?.serviceDate ?? '',
    dailyRouteId: preselectedRoute?.id ?? '',
    accompanyingDocuments: [],
    notes: '',
    animals: [emptyAnimal(1)],
  }
  return { ...values, billingClient: { ...values.billingClient, ...payerIdentity(values) } }
}

function formatDepartureDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

type SelectOption = { id: string; label: string }

function FormSelect({
  ariaLabel,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  ariaLabel: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder: string
  disabled?: boolean
}) {
  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={value}
      isDisabled={disabled}
      onSelectionChange={(key) => onChange(String(key ?? ''))}
    >
      <SelectTrigger className="bg-background min-h-11">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectList items={[{ id: '', label: placeholder }, ...options]}>
          {(option) => (
            <SelectItem id={option.id} textValue={option.label}>
              {option.label}
            </SelectItem>
          )}
        </SelectList>
      </SelectContent>
    </Select>
  )
}

function StopMapLink({ stop }: { stop: RouteStop }) {
  return (
    <a
      className="text-accent mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold hover:underline"
      href={transportLocationMapsUrl(stop.locality, stop.latitude, stop.longitude)}
      target="_blank"
      rel="noreferrer"
    >
      <MapPin size={14} /> Abrir en Google Maps
    </a>
  )
}

function ageInMonths(birthDate: string, onDate: string) {
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number)
  const [year, month, day] = onDate.split('-').map(Number)
  return (year - birthYear) * 12 + (month - birthMonth) - (day < birthDay ? 1 : 0)
}

function petAgeNotice(birthDate: string, travelDate: string) {
  if (!birthDate) return ''
  const months = ageInMonths(birthDate, travelDate)
  if (months < 2)
    return 'El día del viaje tendrá menos de 2 meses. Para viajar debe tener al menos 2 meses; puedes continuar y lo revisaremos contigo.'
  if (months >= 3)
    return 'Con más de 3 meses es obligatorio que lleve microchip. Puedes continuar, pero debe tenerlo implantado el día del viaje.'
  return ''
}

function petRequiredDocuments(animal: TransportRequestAnimal, travelDate: string) {
  if (animal.species !== 'Canina' && animal.species !== 'Felina')
    return ['Cartilla o documentación sanitaria, si la tiene.']
  const documents = ['Cartilla sanitaria o pasaporte con las vacunas al día.']
  if (!animal.birthDate) documents.push('Microchip implantado si tiene 3 meses o más.')
  else if (ageInMonths(animal.birthDate, travelDate) >= 3)
    documents.push('Microchip implantado y registrado.')
  return documents
}

function PetDocumentsNotice({
  animals,
  travelDate,
}: {
  animals: TransportRequestAnimal[]
  travelDate: string
}) {
  const withSpecies = animals.filter((animal) => animal.species)
  if (!withSpecies.length) return null
  return (
    <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-5 text-sky-900">
      <p className="flex items-center gap-1.5 font-semibold">
        <FileText size={14} className="shrink-0" /> Documentación que debe traer el día del viaje
      </p>
      {withSpecies.map((animal) => (
        <div key={animal.ordinal} className="mt-1.5">
          {withSpecies.length > 1 && (
            <strong>{animal.name.trim() || `Mascota ${animal.ordinal}`}</strong>
          )}
          <ul className="list-disc pl-5">
            {petRequiredDocuments(animal, travelDate).map((document) => (
              <li key={document}>{document}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function SharedBoxNotice() {
  return (
    <p className="mt-3 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
      <PawPrint size={14} className="mt-0.5 shrink-0" />
      <span>
        Cada mascota viaja en su propio box. Si quieres que vayan juntas en el mismo box, contacta
        con{' '}
        <a
          className="font-bold underline"
          href={`https://wa.me/34658604933?text=${encodeURIComponent('Hola Stella, quiero consultar la disponibilidad para que mis mascotas viajen juntas en el mismo box.')}`}
          target="_blank"
          rel="noreferrer"
        >
          Stella por WhatsApp (658 60 49 33)
        </a>{' '}
        para consultar la disponibilidad.
      </span>
    </p>
  )
}

const accompanyingDocumentOptions: Array<[AccompanyingDocument, string]> = [
  ['cartilla_sanitaria', 'Cartilla sanitaria'],
  ['microchip', 'Microchip'],
  ['pasaporte', 'Pasaporte'],
  ['tatuaje', 'Tatuaje'],
  ['anillo', 'Anillo'],
  ['cites', 'CITES'],
  ['otro', 'Otro documento'],
]

function RequestDocumentsField({
  documents,
  onChange,
}: {
  documents: AccompanyingDocument[]
  onChange: (documents: AccompanyingDocument[]) => void
}) {
  function toggle(document: AccompanyingDocument) {
    onChange(
      documents.includes(document)
        ? documents.filter((item) => item !== document)
        : [...documents, document],
    )
  }

  return (
    <fieldset className="mt-5 rounded-lg border border-[#e2e2e2] p-3">
      <legend className="px-1 text-sm font-semibold">Documentación aportada</legend>
      <p className="text-muted-foreground mb-3 text-xs">
        Marca la documentación que tienes y aportarás para el viaje.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {accompanyingDocumentOptions.map(([value, label]) => (
          <label
            className="border-border bg-card flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium"
            key={value}
          >
            <input
              type="checkbox"
              checked={documents.includes(value)}
              onChange={() => toggle(value)}
              className="accent-[#9d1921]"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

type Props = {
  routes: UpcomingRoute[]
  contactName: string
  contactPhone: string
  contactEmail: string
  onSubmit: (values: RequestFormValues) => Promise<void>
  onCancel: () => void
  boxCatalog: TransportBoxCatalog
  pendingPayment?: boolean
  onRetryPayment?: () => Promise<void>
  initialRouteId?: string
  adminMode?: boolean
}

export function ClientRequestForm({
  routes,
  contactName,
  contactPhone,
  contactEmail,
  onSubmit,
  onCancel,
  boxCatalog,
  pendingPayment = false,
  onRetryPayment,
  initialRouteId,
  adminMode = false,
}: Props) {
  const [values, setValues] = useState(() =>
    initialValues(
      contactName,
      contactPhone,
      contactEmail,
      routes.find((route) => route.id === initialRouteId),
    ),
  )
  const [step, setStep] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const travelDate = values.desiredDate || today
  const [originSuggestion, setOriginSuggestion] = useState('')
  const originSuggestionRequest = useRef(0)
  const suggestedCities = useRef({ senderCity: '', recipientCity: '' })

  async function retryPayment() {
    if (!onRetryPayment) return
    setSending(true)
    setError('')
    try {
      await onRetryPayment()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No hemos podido registrar el pago de la solicitud.',
      )
    } finally {
      setSending(false)
    }
  }

  function updateAnimal(index: number, patch: Partial<TransportRequestAnimal>) {
    setValues((current) => ({
      ...current,
      animals: current.animals.map((animal, position) =>
        position === index ? { ...animal, ...patch } : animal,
      ),
    }))
  }

  function selectBillingPayer(billingPayer: InvoicePayer) {
    setValues((current) => ({
      ...current,
      billingPayer,
      billingClient: { ...invoiceClient(), ...payerIdentity({ ...current, billingPayer }) },
    }))
  }

  function updateBillingClient(field: keyof InvoiceClientInput, value: string) {
    setValues((current) => ({
      ...current,
      billingClient: { ...current.billingClient, [field]: value },
    }))
  }

  function updateContact(field: PartyField, value: string) {
    setValues((current) => {
      const next = { ...current, [field]: value }
      return { ...next, billingClient: { ...current.billingClient, ...payerIdentity(next) } }
    })
  }

  function validateRoute() {
    return routeSelectionError(routes, values)
  }

  function validateCurrentStep() {
    if (step === 1) {
      const requiredPartyFields: Array<[string, string]> = [
        ['nombre de quien envía', values.contactName],
        ['DNI/NIE de quien envía', values.senderNif],
        ['teléfono de quien envía', values.contactPhone],
        ['correo de quien envía', values.contactEmail],
        ['dirección de quien envía', values.senderAddress],
        ['código postal de quien envía', values.senderPostalCode],
        ['localidad de quien envía', values.senderCity],
        ['provincia de quien envía', values.senderProvince],
        ['nombre de quien recibe', values.recipientName],
        ['DNI/NIE de quien recibe', values.recipientNif],
        ['teléfono de quien recibe', values.recipientPhone],
        ['correo de quien recibe', values.recipientEmail],
        ['dirección de quien recibe', values.recipientAddress],
        ['código postal de quien recibe', values.recipientPostalCode],
        ['localidad de quien recibe', values.recipientCity],
        ['provincia de quien recibe', values.recipientProvince],
      ]
      const missingPartyField = requiredPartyFields.find(([, value]) => !value.trim())
      if (missingPartyField) return `Completa el ${missingPartyField[0]}.`
      if (!/^\S+@\S+\.\S+$/.test(values.contactEmail))
        return 'Escribe un correo electrónico válido.'
      if (!/^\S+@\S+\.\S+$/.test(values.recipientEmail))
        return 'Escribe un correo válido para quien recibe.'
      const requiredFiscalFields: Array<[string, string]> =
        values.billingPayer === 'manual'
          ? [
              ['nombre o razón social', values.billingClient.fullName],
              ['NIF/CIF', values.billingClient.nif],
              ['dirección fiscal', values.billingClient.address],
              ['código postal', values.billingClient.postalCode],
              ['ciudad', values.billingClient.city],
              ['correo del pagador', values.billingClient.email],
              ['teléfono del pagador', values.billingClient.phone],
            ]
          : []
      const missingFiscalField = requiredFiscalFields.find(([, value]) => !value.trim())
      if (missingFiscalField) return `Completa los datos fiscales: ${missingFiscalField[0]}.`
      if (values.billingPayer === 'manual' && !/^\S+@\S+\.\S+$/.test(values.billingClient.email))
        return 'Escribe un correo válido para el pagador.'
    }
    if (step === 0) return validateRoute()
    if (step === 2) {
      const incompleteAnimal = values.animals.some(
        (animal) =>
          !animal.name.trim() ||
          !animal.species.trim() ||
          !animal.breed.trim() ||
          !animal.birthDate ||
          !hasMeasurements(animal),
      )
      if (incompleteAnimal)
        return 'Completa el nombre, especie, raza, fecha de nacimiento, peso y medidas de cada mascota.'
      if (!values.accompanyingDocuments.length)
        return 'Selecciona al menos un documento que aportarás para el viaje.'
    }
    return ''
  }

  function next() {
    const message = validateCurrentStep()
    if (message) return setError(message)
    setError('')
    // Al salir de Trayecto, la localidad de recogida y la de entrega sirven de punto
    // de partida para quien envía y quien recibe (solo si siguen vacías).
    if (step === 0) {
      const cities = suggestedPartyCities(values, suggestedCities.current, values)
      suggestedCities.current = { senderCity: values.origin, recipientCity: values.destination }
      setValues((current) => ({ ...current, ...cities }))
    }
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Pulsar Intro en un paso intermedio avanza de paso; solo el último envía la solicitud.
    if (step < steps.length - 1) return next()
    const message = validateCurrentStep() || validateRoute()
    if (message) return setError(message)
    setSending(true)
    setError('')
    try {
      const normalizedValues = {
        ...values,
        billingClient: { ...values.billingClient, ...payerIdentity(values) },
        animals: values.animals.map((animal) => {
          const minimumCategory = minimumTransportBoxCategory(animal, boxCatalog)
          const requestedCategory = requestedTransportBoxCategory(
            animal,
            minimumCategory,
            boxCatalog,
          )
          return {
            ...animal,
            minimumBoxCategory: minimumCategory,
            requestedBoxCategory: requestedCategory,
          }
        }),
      }
      await onSubmit(normalizedValues)
      setValues(initialValues(contactName, contactPhone, contactEmail))
      setStep(0)
      onCancel()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No hemos podido registrar la solicitud.',
      )
    } finally {
      setSending(false)
    }
  }

  const selectedRoute = routes.find((route) => route.id === values.dailyRouteId)
  const requestTotal = transportAnimalsTotalCents(values.animals, boxCatalog) / 100
  const routeStops = selectedRoute?.localities ?? []
  const pickupStopIndex =
    selectedRoute?.stops.findIndex((stop) => stop.locality === values.origin) ?? -1
  const pickupStop = pickupStopIndex >= 0 ? selectedRoute?.stops[pickupStopIndex] : undefined
  const deliveryStopIndex =
    selectedRoute && pickupStopIndex >= 0 && values.destination
      ? selectedRoute.stops.findIndex(
          (stop, index) => index > pickupStopIndex && stop.locality === values.destination,
        )
      : -1
  const deliveryStop = deliveryStopIndex >= 0 ? selectedRoute?.stops[deliveryStopIndex] : undefined
  const arrivals = selectedRoute
    ? routeStopArrivals(
        selectedRoute.serviceDate,
        selectedRoute.startTime ?? DEFAULT_ROUTE_START_TIME,
        selectedRoute.stops,
      )
    : []
  const pickupArrival = pickupStopIndex >= 0 ? arrivals[pickupStopIndex] : undefined
  const deliveryArrival = deliveryStopIndex >= 0 ? arrivals[deliveryStopIndex] : undefined
  // Localities can repeat (several stops in one town); select option ids must be unique.
  const originStops = pickupOptions(routeStops)
  const destinationStops = deliveryOptions(routeStops, values.origin)

  function selectRoute(routeId: string) {
    const route = routes.find((item) => item.id === routeId)
    const requestId = ++originSuggestionRequest.current
    setValues((current) => ({
      ...current,
      dailyRouteId: routeId,
      desiredDate: route?.serviceDate ?? '',
      origin: '',
      destination: '',
    }))
    if (
      !route ||
      !route.stops.some((stop) => stop.latitude !== undefined && stop.longitude !== undefined)
    ) {
      setOriginSuggestion('')
      return
    }
    void suggestNearestPickup(route, requestId)
  }

  async function suggestNearestPickup(route: UpcomingRoute, requestId: number) {
    setOriginSuggestion('Buscando la parada de recogida más cercana…')
    try {
      const origin = findNearestPickupStop(await getCurrentLocation(), route.stops)
      if (requestId !== originSuggestionRequest.current) return
      if (!origin) {
        setOriginSuggestion(
          'No hemos podido sugerir una recogida. Puedes seleccionarla manualmente.',
        )
        return
      }
      setValues((current) =>
        current.dailyRouteId === route.id && !current.origin
          ? { ...current, origin, destination: '' }
          : current,
      )
      setOriginSuggestion(`Hemos seleccionado ${origin} como recogida más cercana.`)
    } catch {
      if (requestId === originSuggestionRequest.current)
        setOriginSuggestion(
          'No hemos podido acceder a tu ubicación. Puedes seleccionar la recogida.',
        )
    }
  }

  if (pendingPayment) {
    return (
      <Card className="table-card client-request-card">
        <CardContent>
          <section className="payment-recovery">
            <div className="text-accent [&_p]:text-muted-foreground mb-3.75 flex items-start gap-2.25 [&_h2]:m-0 [&_h2]:text-lg [&_p]:mt-1 [&_p]:text-[13px] [&_p]:leading-5">
              <CreditCard size={17} />
              <div>
                <h2>Tu solicitud está guardada</h2>
                <p>
                  No crearemos otra. Solo falta confirmar el registro del pago para enviarla a
                  operaciones.
                </p>
              </div>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="request-form-actions">
              <Button type="button" variant="outline" onClick={onCancel} disabled={sending}>
                Cerrar
              </Button>
              <Button type="button" onClick={() => void retryPayment()} disabled={sending}>
                <CreditCard size={16} /> {sending ? 'Registrando pago…' : 'Reintentar pago'}
              </Button>
            </div>
          </section>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="client-request-form-shell">
      <form className="request-form" onSubmit={(event) => void submit(event)} noValidate>
        <div className="request-form-heading">
          <div>
            <div className="request-form-kicker">
              {adminMode ? 'Alta interna · sin cobro' : 'Nueva solicitud'}
            </div>
            <h2>
              {adminMode ? 'Crear transporte manualmente' : 'Organiza el viaje en cuatro pasos'}
            </h2>
            <p>
              {adminMode
                ? 'Completa los datos del cliente como si lo hiciera desde el portal. La solicitud quedará lista para revisar, sin pasar por la pasarela de pago.'
                : 'Guardaremos tus datos para que puedas seguir el transporte desde aquí.'}
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
        <ol className="request-steps" aria-label="Progreso de solicitud">
          {(adminMode
            ? steps.map((label) => (label === 'Contacto' ? 'Cliente' : label))
            : steps
          ).map((label, index) => (
            <li
              key={label}
              className={index === step ? 'is-current' : index < step ? 'is-complete' : ''}
            >
              <span>{index < step ? <Check size={13} /> : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <section className="request-step-panel border-border bg-muted/20 rounded-xl border p-4 shadow-sm sm:p-5">
            <div className="request-step-hero mb-5 flex items-start gap-3">
              <span className="bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-full">
                <ShieldCheck size={17} />
              </span>
              <div>
                <span className="request-step-eyebrow">Paso 1 de 4</span>
                <h3 className="text-foreground text-base font-semibold">
                  {adminMode ? 'Datos del cliente' : 'Datos de contacto'}
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {adminMode
                    ? 'Los usaremos para que operaciones pueda contactar con la persona responsable del transporte.'
                    : 'Los usaremos para gestionar la reserva y resolver cualquier incidencia.'}
                </p>
              </div>
            </div>
            <div className="request-form-block">
              <div className="request-form-block-heading">
                <span className="request-form-block-icon">01</span>
                <div>
                  <h4>Quién envía la mascota</h4>
                  <p>La confirmación y cualquier incidencia llegarán a estos datos.</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="request-contact-name">Nombre y apellidos</FieldLabel>
                  <Input
                    id="request-contact-name"
                    value={values.contactName}
                    onChange={(event) => updateContact('contactName', event.target.value)}
                    autoComplete="name"
                    placeholder="Nombre completo"
                    className="min-h-11"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="request-sender-nif">DNI/NIE</FieldLabel>
                  <Input
                    id="request-sender-nif"
                    value={values.senderNif}
                    onChange={(event) => updateContact('senderNif', event.target.value)}
                    placeholder="12345678Z"
                    className="min-h-11"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="request-contact-phone">Teléfono de contacto</FieldLabel>
                  <Input
                    id="request-contact-phone"
                    type="tel"
                    value={values.contactPhone}
                    onChange={(event) => updateContact('contactPhone', event.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="600 000 000"
                    className="min-h-11"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="request-contact-email">Correo electrónico</FieldLabel>
                  <Input
                    id="request-contact-email"
                    type="email"
                    value={values.contactEmail}
                    onChange={(event) => updateContact('contactEmail', event.target.value)}
                    autoComplete="email"
                    placeholder="nombre@correo.com"
                    className="min-h-11"
                    required
                  />
                  <FieldDescription>
                    {adminMode
                      ? 'Usaremos este correo para enviar la información al cliente.'
                      : 'Aquí recibirás la información de tu solicitud.'}
                  </FieldDescription>
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="request-sender-address">Dirección completa</FieldLabel>
                  <Input
                    id="request-sender-address"
                    value={values.senderAddress}
                    onChange={(event) => updateContact('senderAddress', event.target.value)}
                    autoComplete="street-address"
                    placeholder="Calle, número, piso…"
                    className="min-h-11"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="request-sender-postal-code">Código postal</FieldLabel>
                  <Input
                    id="request-sender-postal-code"
                    value={values.senderPostalCode}
                    onChange={(event) => updateContact('senderPostalCode', event.target.value)}
                    autoComplete="postal-code"
                    className="min-h-11"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="request-sender-city">Localidad</FieldLabel>
                  <Input
                    id="request-sender-city"
                    value={values.senderCity}
                    onChange={(event) => updateContact('senderCity', event.target.value)}
                    autoComplete="address-level2"
                    className="min-h-11"
                    required
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="request-sender-province">Provincia</FieldLabel>
                  <Input
                    id="request-sender-province"
                    value={values.senderProvince}
                    onChange={(event) => updateContact('senderProvince', event.target.value)}
                    autoComplete="address-level1"
                    className="min-h-11"
                    required
                  />
                </Field>
              </div>
            </div>
            <div className="request-form-block">
              <div className="request-form-block-heading">
                <span className="request-form-block-icon">02</span>
                <div>
                  <h4>Quién recibe la mascota</h4>
                  <p>Persona que recogerá la mascota en destino.</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="request-recipient-name">Nombre y apellidos</FieldLabel>
                  <Input
                    id="request-recipient-name"
                    value={values.recipientName}
                    onChange={(event) => updateContact('recipientName', event.target.value)}
                    placeholder="Nombre completo"
                    className="min-h-11"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="request-recipient-nif">DNI/NIE</FieldLabel>
                  <Input
                    id="request-recipient-nif"
                    value={values.recipientNif}
                    onChange={(event) => updateContact('recipientNif', event.target.value)}
                    placeholder="12345678Z"
                    className="min-h-11"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="request-recipient-phone">Teléfono</FieldLabel>
                  <Input
                    id="request-recipient-phone"
                    type="tel"
                    value={values.recipientPhone}
                    onChange={(event) => updateContact('recipientPhone', event.target.value)}
                    inputMode="tel"
                    placeholder="600 000 000"
                    className="min-h-11"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="request-recipient-email">Correo electrónico</FieldLabel>
                  <Input
                    id="request-recipient-email"
                    type="email"
                    value={values.recipientEmail}
                    onChange={(event) => updateContact('recipientEmail', event.target.value)}
                    autoComplete="email"
                    placeholder="nombre@correo.com"
                    className="min-h-11"
                    required
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="request-recipient-address">Dirección completa</FieldLabel>
                  <Input
                    id="request-recipient-address"
                    value={values.recipientAddress}
                    onChange={(event) => updateContact('recipientAddress', event.target.value)}
                    autoComplete="street-address"
                    placeholder="Calle, número, piso…"
                    className="min-h-11"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="request-recipient-postal-code">Código postal</FieldLabel>
                  <Input
                    id="request-recipient-postal-code"
                    value={values.recipientPostalCode}
                    onChange={(event) => updateContact('recipientPostalCode', event.target.value)}
                    autoComplete="postal-code"
                    className="min-h-11"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="request-recipient-city">Localidad</FieldLabel>
                  <Input
                    id="request-recipient-city"
                    value={values.recipientCity}
                    onChange={(event) => updateContact('recipientCity', event.target.value)}
                    autoComplete="address-level2"
                    className="min-h-11"
                    required
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="request-recipient-province">Provincia</FieldLabel>
                  <Input
                    id="request-recipient-province"
                    value={values.recipientProvince}
                    onChange={(event) => updateContact('recipientProvince', event.target.value)}
                    autoComplete="address-level1"
                    className="min-h-11"
                    required
                  />
                </Field>
              </div>
            </div>
            <div className="request-form-block request-billing-block">
              <div className="request-form-block-heading">
                <span className="request-form-block-icon">03</span>
                <div>
                  <h4>Datos para la factura</h4>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Si paga quien envía o recibe, usaremos los datos que ya has indicado. Solo
                    tendrás que completar estos datos si paga una empresa externa.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="request-billing-payer">
                    ¿Quién paga el transporte?
                  </FieldLabel>
                  <select
                    id="request-billing-payer"
                    className="border-input bg-background min-h-11 rounded-md border px-3 text-sm"
                    value={values.billingPayer}
                    onChange={(event) => selectBillingPayer(event.target.value as InvoicePayer)}
                  >
                    <option value="remitente">La persona que envía el animal</option>
                    <option value="destinatario">La persona que recibe el animal</option>
                    <option value="manual">Otra persona o empresa</option>
                  </select>
                </Field>
                {values.billingPayer === 'manual' ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="request-billing-name">Nombre o razón social</FieldLabel>
                      <Input
                        id="request-billing-name"
                        value={values.billingClient.fullName}
                        onChange={(event) => updateBillingClient('fullName', event.target.value)}
                        autoComplete="organization"
                        placeholder="Nombre completo o empresa"
                        className="min-h-11"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="request-billing-nif">NIF/CIF</FieldLabel>
                      <Input
                        id="request-billing-nif"
                        value={values.billingClient.nif}
                        onChange={(event) => updateBillingClient('nif', event.target.value)}
                        placeholder="NIF o CIF"
                        className="min-h-11"
                        required
                      />
                    </Field>
                    <Field className="sm:col-span-2">
                      <FieldLabel htmlFor="request-billing-address">Dirección fiscal</FieldLabel>
                      <Input
                        id="request-billing-address"
                        value={values.billingClient.address}
                        onChange={(event) => updateBillingClient('address', event.target.value)}
                        autoComplete="street-address"
                        placeholder="Calle, número, piso…"
                        className="min-h-11"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="request-billing-postal-code">Código postal</FieldLabel>
                      <Input
                        id="request-billing-postal-code"
                        value={values.billingClient.postalCode}
                        onChange={(event) => updateBillingClient('postalCode', event.target.value)}
                        autoComplete="postal-code"
                        className="min-h-11"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="request-billing-city">Localidad</FieldLabel>
                      <Input
                        id="request-billing-city"
                        value={values.billingClient.city}
                        onChange={(event) => updateBillingClient('city', event.target.value)}
                        autoComplete="address-level2"
                        className="min-h-11"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="request-billing-email">Correo del pagador</FieldLabel>
                      <Input
                        id="request-billing-email"
                        type="email"
                        value={values.billingClient.email}
                        onChange={(event) => updateBillingClient('email', event.target.value)}
                        autoComplete="email"
                        className="min-h-11"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="request-billing-phone">Teléfono del pagador</FieldLabel>
                      <Input
                        id="request-billing-phone"
                        type="tel"
                        value={values.billingClient.phone}
                        onChange={(event) => updateBillingClient('phone', event.target.value)}
                        autoComplete="tel"
                        className="min-h-11"
                        required
                      />
                    </Field>
                  </>
                ) : (
                  <output
                    aria-live="polite"
                    className="bg-muted/40 text-foreground border-border rounded-lg border p-4 sm:col-span-2"
                  >
                    <p className="font-semibold">
                      La factura utilizará los datos de quien{' '}
                      {values.billingPayer === 'remitente' ? 'envía' : 'recibe'}.
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {values.billingClient.fullName} · {values.billingClient.nif} ·{' '}
                      {values.billingClient.email} · {values.billingClient.phone}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {values.billingClient.address}, {values.billingClient.postalCode}{' '}
                      {values.billingClient.city}
                    </p>
                    <FieldDescription className="mt-2">
                      No hace falta volver a rellenar estos datos.
                    </FieldDescription>
                  </output>
                )}
              </div>
            </div>
          </section>
        )}

        {step === 0 && (
          <section className="border-border bg-muted/20 rounded-xl border p-4 shadow-sm sm:p-5">
            <div className="mb-5 flex items-start gap-3">
              <span className="bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-full">
                <ArrowRight size={17} />
              </span>
              <div>
                <h3 className="text-foreground text-base font-semibold">
                  Elige una salida publicada
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  La fecha y las paradas disponibles dependen de la ruta seleccionada.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2">
                <FieldLabel>Ruta y fecha</FieldLabel>
                <FormSelect
                  ariaLabel="Ruta y fecha"
                  value={values.dailyRouteId}
                  onChange={selectRoute}
                  placeholder="Selecciona una salida"
                  options={routes.map((route) => ({
                    id: route.id,
                    label: `${route.templateName || 'Ruta programada'} · ${routeDaysLabel(route.serviceDate, route.endDate)} de ${route.serviceDate.slice(0, 4)} · ${route.routeDirection === 'inversa' ? 'sentido inverso' : 'sentido habitual'}`,
                  }))}
                />
                {originSuggestion && (
                  <output className="text-muted-foreground mt-2 block text-xs" aria-live="polite">
                    {originSuggestion}
                  </output>
                )}
              </Field>
              <Field>
                <FieldLabel>Recogida</FieldLabel>
                <FormSelect
                  ariaLabel="Recogida"
                  value={values.origin}
                  onChange={(origin) =>
                    setValues((current) => ({ ...current, origin, destination: '' }))
                  }
                  placeholder="Selecciona una parada"
                  options={originStops.map((stop) => ({ id: stop, label: stop }))}
                  disabled={!selectedRoute}
                />
                {pickupStop && <StopMapLink stop={pickupStop} />}
                {pickupArrival && (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Recogida aproximada: {formatDepartureDate(pickupArrival.date)} ·{' '}
                    {approximateArrivalPeriod(pickupArrival.time)}
                  </p>
                )}
              </Field>
              <Field>
                <FieldLabel>Entrega</FieldLabel>
                <FormSelect
                  ariaLabel="Entrega"
                  value={values.destination}
                  onChange={(destination) => setValues((current) => ({ ...current, destination }))}
                  placeholder="Selecciona una parada"
                  options={destinationStops.map((stop) => ({ id: stop, label: stop }))}
                  disabled={!values.origin}
                />
                {deliveryStop && <StopMapLink stop={deliveryStop} />}
                {deliveryArrival && (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Entrega aproximada: {formatDepartureDate(deliveryArrival.date)} ·{' '}
                    {approximateArrivalPeriod(deliveryArrival.time)}
                  </p>
                )}
              </Field>
              <Field>
                <FieldLabel id="request-desired-date-label" htmlFor="request-desired-date">
                  Fecha de salida
                </FieldLabel>
                <output
                  id="request-desired-date"
                  aria-labelledby="request-desired-date-label"
                  aria-live="polite"
                  className="bg-muted/40 text-foreground flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5"
                >
                  <CalendarDays className="text-accent size-5 shrink-0" aria-hidden="true" />
                  <span className="grid gap-0.5">
                    <strong className="text-sm font-semibold">
                      {values.desiredDate
                        ? formatDepartureDate(values.desiredDate)
                        : 'Selecciona una salida'}
                    </strong>
                    <span className="text-muted-foreground text-xs">
                      Franja orientativa; confirmaremos la hora exacta al cerrar la ruta.
                    </span>
                  </span>
                </output>
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="request-notes">Algo que debamos tener en cuenta</FieldLabel>
                <Textarea
                  id="request-notes"
                  value={values.notes}
                  onChange={(event) => setValues({ ...values, notes: event.target.value })}
                  placeholder="Opcional: horario, punto de encuentro, necesidades especiales…"
                  rows={3}
                />
              </Field>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="border-border bg-muted/20 rounded-xl border p-4 shadow-sm sm:p-5">
            <div className="mb-5 flex items-start gap-3">
              <span className="bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-full">
                <PawPrint size={17} />
              </span>
              <div>
                <h3 className="text-foreground text-base font-semibold">Tu mascota</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Con estas medidas reservamos un espacio adecuado en la furgoneta.
                </p>
              </div>
            </div>
            {values.animals.map((animal, index) => (
              <div
                className="border-border bg-background rounded-xl border p-4"
                key={animal.ordinal}
              >
                <div className="text-foreground mb-4 flex items-center justify-between gap-2.5 text-sm font-semibold">
                  <span>Mascota {index + 1}</span>
                  {values.animals.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-accent hover:text-accent"
                      onClick={() =>
                        setValues({
                          ...values,
                          animals: values.animals
                            .filter((_, position) => position !== index)
                            .map((item, position) => ({ ...item, ordinal: position + 1 })),
                        })
                      }
                    >
                      <Trash2 size={14} /> Quitar
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`animal-${animal.ordinal}-name`}>Nombre</FieldLabel>
                    <Input
                      id={`animal-${animal.ordinal}-name`}
                      value={animal.name}
                      onChange={(event) => updateAnimal(index, { name: event.target.value })}
                      placeholder="Por ejemplo, Luna"
                      className="min-h-11"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`animal-${animal.ordinal}-species`}>Especie</FieldLabel>
                    <select
                      id={`animal-${animal.ordinal}-species`}
                      value={animal.species}
                      onChange={(event) => updateAnimal(index, { species: event.target.value })}
                      className="border-input bg-background text-foreground focus-visible:ring-ring min-h-11 w-full rounded-md border px-3 text-sm shadow-sm outline-none focus-visible:ring-2"
                      required
                    >
                      <option value="">Selecciona una especie</option>
                      <option value="Canina">Perro</option>
                      <option value="Felina">Gato</option>
                      <option value="Ave">Ave</option>
                      <option value="Roedor">Roedor</option>
                      <option value="Reptil">Reptil</option>
                      <option value="Otra">Otra</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`animal-${animal.ordinal}-breed`}>Raza</FieldLabel>
                    <Input
                      id={`animal-${animal.ordinal}-breed`}
                      value={animal.breed}
                      onChange={(event) => updateAnimal(index, { breed: event.target.value })}
                      placeholder="Mestiza, Labrador…"
                      className="min-h-11"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`animal-${animal.ordinal}-birth-date`}>
                      Fecha de nacimiento
                    </FieldLabel>
                    <Input
                      id={`animal-${animal.ordinal}-birth-date`}
                      type="date"
                      max={today}
                      value={animal.birthDate}
                      onChange={(event) => updateAnimal(index, { birthDate: event.target.value })}
                      className="min-h-11"
                      required
                    />
                    {(() => {
                      const notice = petAgeNotice(animal.birthDate, travelDate)
                      return (
                        notice && (
                          <p className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-900">
                            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                            {notice}
                          </p>
                        )
                      )
                    })()}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`animal-${animal.ordinal}-weight`}>Peso (kg)</FieldLabel>
                    <Input
                      id={`animal-${animal.ordinal}-weight`}
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={animal.weightKg || ''}
                      onChange={(event) =>
                        updateAnimal(index, { weightKg: Number(event.target.value) })
                      }
                      className="min-h-11"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`animal-${animal.ordinal}-length`}>Largo (cm)</FieldLabel>
                    <Input
                      id={`animal-${animal.ordinal}-length`}
                      type="number"
                      min="1"
                      step="1"
                      value={animal.lengthCm || ''}
                      onChange={(event) =>
                        updateAnimal(index, { lengthCm: Number(event.target.value) })
                      }
                      className="min-h-11"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`animal-${animal.ordinal}-height`}>Alto (cm)</FieldLabel>
                    <Input
                      id={`animal-${animal.ordinal}-height`}
                      type="number"
                      min="1"
                      step="1"
                      value={animal.heightCm || ''}
                      onChange={(event) =>
                        updateAnimal(index, { heightCm: Number(event.target.value) })
                      }
                      className="min-h-11"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`animal-${animal.ordinal}-width`}>Ancho (cm)</FieldLabel>
                    <Input
                      id={`animal-${animal.ordinal}-width`}
                      type="number"
                      min="1"
                      step="1"
                      value={animal.widthCm || ''}
                      onChange={(event) =>
                        updateAnimal(index, { widthCm: Number(event.target.value) })
                      }
                      className="min-h-11"
                      required
                    />
                  </Field>
                </div>
                {(() => {
                  const measured = hasMeasurements(animal)
                  const minimumCategory = minimumTransportBoxCategory(animal, boxCatalog)
                  const requestedCategory = requestedTransportBoxCategory(
                    animal,
                    minimumCategory,
                    boxCatalog,
                  )
                  return (
                    <div className="mt-3 grid gap-3">
                      <p className="text-muted-foreground text-xs">
                        {measured ? (
                          <>
                            Recomendación automática: {transportBoxCategoryLabel(minimumCategory)} ·{' '}
                            {boxCatalog[minimumCategory].dimensions}
                          </>
                        ) : (
                          'Indica el peso y las medidas para elegir la categoría de box.'
                        )}
                      </p>
                      <Field>
                        <FieldLabel htmlFor={`animal-${animal.ordinal}-box-category`}>
                          Categoría de box
                        </FieldLabel>
                        <select
                          id={`animal-${animal.ordinal}-box-category`}
                          className="border-input bg-background min-h-11 rounded-md border px-3 text-sm"
                          value={requestedCategory}
                          disabled={!measured}
                          onChange={(event) =>
                            updateAnimal(index, {
                              requestedBoxCategory: event.target
                                .value as TransportRequestAnimal['requestedBoxCategory'],
                            })
                          }
                        >
                          {transportBoxOptions(minimumCategory, animal.weightKg, boxCatalog).map(
                            (category) => (
                              <option value={category} key={category}>
                                {transportBoxCategoryLabel(category)} ·{' '}
                                {currency(
                                  transportBoxPriceCents(
                                    category,
                                    { weightKg: animal.weightKg },
                                    boxCatalog,
                                  ) / 100,
                                )}
                                {transportBoxCategoryRank(category) >
                                transportBoxCategoryRank(minimumCategory)
                                  ? ' · extra por comodidad'
                                  : ''}
                              </option>
                            ),
                          )}
                        </select>
                      </Field>
                    </div>
                  )
                })()}
                <PetDocumentsNotice animals={[animal]} travelDate={travelDate} />
              </div>
            ))}
            {values.animals.length > 1 && <SharedBoxNotice />}
            <Button
              type="button"
              variant="outline"
              className="text-accent mt-4 min-h-11 w-full border-dashed"
              onClick={() =>
                setValues({
                  ...values,
                  animals: [...values.animals, emptyAnimal(values.animals.length + 1)],
                })
              }
            >
              <Plus size={15} /> Añadir otra mascota
            </Button>
            <RequestDocumentsField
              documents={values.accompanyingDocuments}
              onChange={(accompanyingDocuments) =>
                setValues((current) => ({ ...current, accompanyingDocuments }))
              }
            />
          </section>
        )}

        {step === 3 && (
          <section className="request-review border-border bg-muted/20 rounded-xl border p-4 shadow-sm sm:p-5">
            <div className="mb-5 flex items-start gap-3">
              <span className="bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-full">
                {adminMode ? <ClipboardCheck size={17} /> : <CreditCard size={17} />}
              </span>
              <div>
                <h3 className="text-foreground text-base font-semibold">
                  {adminMode ? 'Revisa y registra' : 'Revisa y confirma'}
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {adminMode
                    ? 'Comprueba que todo está correcto antes de crear la solicitud interna.'
                    : 'Tu solicitud se enviará a operaciones después de registrar el pago.'}
                </p>
              </div>
            </div>
            <div className="request-review-grid">
              <div>
                <span>Envía</span>
                <strong>{values.contactName}</strong>
                <small>
                  {values.senderNif} · {values.contactPhone} · {values.contactEmail}
                </small>
                <small>
                  {values.senderAddress}, {values.senderPostalCode} {values.senderCity},{' '}
                  {values.senderProvince}
                </small>
              </div>
              <div>
                <span>Recibe</span>
                <strong>{values.recipientName}</strong>
                <small>
                  {values.recipientNif} · {values.recipientPhone} · {values.recipientEmail}
                </small>
                <small>
                  {values.recipientAddress}, {values.recipientPostalCode} {values.recipientCity},{' '}
                  {values.recipientProvince}
                </small>
              </div>
              <div>
                <span>Factura a nombre de</span>
                <strong>{values.billingClient.fullName}</strong>
                <small>
                  {values.billingPayer === 'remitente'
                    ? 'Persona que envía'
                    : values.billingPayer === 'destinatario'
                      ? 'Persona que recibe'
                      : 'Otra persona o empresa'}{' '}
                  · {values.billingClient.nif}
                </small>
              </div>
              <div>
                <span>Trayecto</span>
                <strong>
                  {values.origin} → {values.destination}
                </strong>
                <small>
                  {new Date(`${values.desiredDate}T12:00:00`).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </small>
              </div>
              <div>
                <span>Mascotas</span>
                <strong>
                  {values.animals.length} mascota{values.animals.length === 1 ? '' : 's'}
                </strong>
                <small>{values.animals.map((animal) => animal.species).join(' · ')}</small>
              </div>
              <div>
                <span>Documentación aportada</span>
                <strong>
                  {values.accompanyingDocuments
                    .map(
                      (document) =>
                        accompanyingDocumentOptions.find(([value]) => value === document)?.[1],
                    )
                    .filter(Boolean)
                    .join(', ')}
                </strong>
              </div>
              <div>
                <span>{adminMode ? 'Importe de referencia' : 'Importe del transporte'}</span>
                <strong>{currency(requestTotal)}</strong>
                <small>Según el tamaño de cada box</small>
              </div>
            </div>
            {values.animals.length > 1 && <SharedBoxNotice />}
            <PetDocumentsNotice animals={values.animals} travelDate={travelDate} />
            <p className="payment-note">
              {adminMode ? <ClipboardCheck size={15} /> : <ShieldCheck size={15} />}{' '}
              {adminMode
                ? 'Se crea sin cobro y queda pendiente de revisión por operaciones.'
                : 'El pago queda registrado y la solicitud pasa directamente a revisión.'}
            </p>
          </section>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="request-form-actions border-border bg-card/95 sticky bottom-0 -mx-4 border-t px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError('')
                setStep((current) => current - 1)
              }}
            >
              <ArrowLeft size={16} /> Atrás
            </Button>
          ) : (
            <span />
          )}
          {step < steps.length - 1 ? (
            <Button type="button" onClick={next}>
              Continuar <ArrowRight size={16} />
            </Button>
          ) : (
            <Button type="submit" disabled={sending}>
              {adminMode ? <ClipboardCheck size={16} /> : <CreditCard size={16} />}{' '}
              {sending
                ? adminMode
                  ? 'Creando solicitud…'
                  : 'Registrando pago…'
                : adminMode
                  ? 'Crear solicitud sin cobro'
                  : 'Confirmar y pagar'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
