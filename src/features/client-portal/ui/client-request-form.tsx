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
  Check,
  CreditCard,
  PawPrint,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'

import {
  minimumTransportBoxCategory,
  transportBoxCategoryLabel,
  transportBoxCategoryRank,
  transportBoxOptions,
  transportBoxPriceCents,
  type TransportBoxCatalog,
} from '@/shared/application/transport-boxes'
import type {
  ClientPet,
  InvoiceClientInput,
  InvoicePayer,
  TransportRequestAnimal,
  UpcomingRoute,
} from '@/shared/types'

import { findNearestPickupStop, getCurrentLocation } from '../application/nearest-route-stop'

export type RequestFormValues = {
  contactName: string
  contactPhone: string
  contactEmail: string
  billingPayer: InvoicePayer
  billingClient: InvoiceClientInput
  origin: string
  destination: string
  desiredDate: string
  dailyRouteId: string
  notes: string
  animals: TransportRequestAnimal[]
}

const steps = ['Contacto', 'Trayecto', 'Mascotas', 'Revisar']
const currency = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
const emptyAnimal = (ordinal: number): TransportRequestAnimal => ({
  ordinal,
  name: '',
  species: '',
  breed: '',
  weightKg: 0,
  lengthCm: 0,
  heightCm: 0,
  widthCm: 0,
})

const invoiceClient = (fullName = '', email = '', phone = ''): InvoiceClientInput => ({
  fullName,
  nif: '',
  email,
  phone,
  address: '',
  city: '',
  postalCode: '',
})

function requestedCategoryFor(
  animal: TransportRequestAnimal,
  minimumCategory: Exclude<
    TransportRequestAnimal['requestedBoxCategory'],
    undefined | 'paso_rueda'
  >,
) {
  const requestedCategory = animal.requestedBoxCategory
  if (
    requestedCategory &&
    (requestedCategory === 'paso_rueda' ||
      transportBoxCategoryRank(requestedCategory) >= transportBoxCategoryRank(minimumCategory))
  ) {
    return requestedCategory
  }
  return minimumCategory
}

const initialValues = (
  contactName: string,
  contactPhone: string,
  contactEmail: string,
  preselectedRoute?: UpcomingRoute,
): RequestFormValues => ({
  contactName,
  contactPhone,
  contactEmail,
  billingPayer: 'remitente',
  billingClient: invoiceClient(contactName, contactEmail, contactPhone),
  origin: '',
  destination: '',
  desiredDate: preselectedRoute?.serviceDate ?? '',
  dailyRouteId: preselectedRoute?.id ?? '',
  notes: '',
  animals: [emptyAnimal(1)],
})

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

type Props = {
  routes: UpcomingRoute[]
  savedPets: ClientPet[]
  contactName: string
  contactPhone: string
  contactEmail: string
  onSubmit: (values: RequestFormValues) => Promise<void>
  onCancel: () => void
  onSavePets: (animals: TransportRequestAnimal[]) => Promise<void>
  boxCatalog: TransportBoxCatalog
  pendingPayment?: boolean
  onRetryPayment?: () => Promise<void>
  initialRouteId?: string
}

export function ClientRequestForm({
  routes,
  savedPets,
  contactName,
  contactPhone,
  contactEmail,
  onSubmit,
  onCancel,
  onSavePets,
  boxCatalog,
  pendingPayment = false,
  onRetryPayment,
  initialRouteId,
}: Props) {
  const [values, setValues] = useState(() =>
    initialValues(
      contactName,
      contactPhone,
      contactEmail,
      routes.find((route) => route.id === initialRouteId),
    ),
  )
  const [step, setStep] = useState(() => (initialRouteId ? 1 : 0))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [petsToSave, setPetsToSave] = useState<TransportRequestAnimal[] | null>(null)
  const [originSuggestion, setOriginSuggestion] = useState('')
  const originSuggestionRequest = useRef(0)

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

  function selectSavedPet(index: number, petId: string) {
    const pet = savedPets.find((item) => item.id === petId)
    if (!pet) return updateAnimal(index, { clientPetId: undefined })
    updateAnimal(index, {
      clientPetId: pet.id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      weightKg: pet.weightKg,
      lengthCm: pet.lengthCm,
      heightCm: pet.heightCm,
      widthCm: pet.widthCm,
    })
  }

  function selectBillingPayer(billingPayer: InvoicePayer) {
    const billingClient =
      billingPayer === 'remitente'
        ? invoiceClient(values.contactName, values.contactEmail, values.contactPhone)
        : invoiceClient()
    setValues((current) => ({ ...current, billingPayer, billingClient }))
  }

  function updateBillingClient(field: keyof InvoiceClientInput, value: string) {
    setValues((current) => ({
      ...current,
      billingClient: { ...current.billingClient, [field]: value },
    }))
  }

  function validateCurrentStep() {
    if (step === 0) {
      if (!values.contactName.trim() || !values.contactPhone.trim() || !values.contactEmail.trim())
        return 'Completa los datos de contacto para poder avisarte.'
      if (!/^\S+@\S+\.\S+$/.test(values.contactEmail))
        return 'Escribe un correo electrónico válido.'
      const requiredFiscalFields: Array<[string, string]> = [
        ['nombre o razón social', values.billingClient.fullName],
        ['NIF/CIF', values.billingClient.nif],
        ['dirección fiscal', values.billingClient.address],
        ['código postal', values.billingClient.postalCode],
        ['ciudad', values.billingClient.city],
        ['correo del pagador', values.billingClient.email],
        ['teléfono del pagador', values.billingClient.phone],
      ]
      const missingFiscalField = requiredFiscalFields.find(([, value]) => !value.trim())
      if (missingFiscalField) return `Completa los datos fiscales: ${missingFiscalField[0]}.`
      if (!/^\S+@\S+\.\S+$/.test(values.billingClient.email))
        return 'Escribe un correo válido para el pagador.'
    }
    if (step === 1) {
      if (!values.dailyRouteId || !values.origin || !values.destination || !values.desiredDate)
        return 'Selecciona una ruta, una recogida y una entrega para continuar.'
      const route = routes.find((item) => item.id === values.dailyRouteId)
      if (!route || route.serviceDate !== values.desiredDate)
        return 'La ruta seleccionada ya no está disponible. Elige otra ruta.'
      const pickupIndex = route.localities.indexOf(values.origin)
      if (pickupIndex < 0 || !route.localities.slice(pickupIndex + 1).includes(values.destination))
        return 'Elige una entrega posterior a la recogida dentro de la ruta.'
    }
    if (step === 2) {
      const incompleteAnimal = values.animals.some(
        (animal) =>
          !animal.name.trim() ||
          !animal.species.trim() ||
          animal.weightKg <= 0 ||
          animal.lengthCm <= 0 ||
          animal.heightCm <= 0 ||
          animal.widthCm <= 0,
      )
      if (incompleteAnimal) return 'Completa el nombre, especie, peso y medidas de cada mascota.'
    }
    return ''
  }

  function next() {
    const message = validateCurrentStep()
    if (message) return setError(message)
    setError('')
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = validateCurrentStep()
    if (message) return setError(message)
    setSending(true)
    setError('')
    try {
      const normalizedValues = {
        ...values,
        billingClient:
          values.billingPayer === 'remitente'
            ? {
                ...values.billingClient,
                fullName: values.contactName,
                email: values.contactEmail,
                phone: values.contactPhone,
              }
            : values.billingClient,
        animals: values.animals.map((animal) => {
          const minimumCategory = minimumTransportBoxCategory(animal)
          const requestedCategory = requestedCategoryFor(animal, minimumCategory)
          return {
            ...animal,
            minimumBoxCategory: minimumCategory,
            requestedBoxCategory: requestedCategory,
          }
        }),
      }
      await onSubmit(normalizedValues)
      const newPets = normalizedValues.animals.filter((animal) => !animal.clientPetId)
      setValues(initialValues(contactName, contactPhone, contactEmail))
      setStep(0)
      if (newPets.length) setPetsToSave(newPets)
      else onCancel()
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

  async function savePets() {
    if (!petsToSave) return
    setSending(true)
    setError('')
    try {
      await onSavePets(petsToSave)
      onCancel()
    } catch {
      setError(
        'Tu solicitud está enviada, pero no hemos podido guardar la mascota. Vuelve a intentarlo.',
      )
    } finally {
      setSending(false)
    }
  }

  const selectedRoute = routes.find((route) => route.id === values.dailyRouteId)
  const requestTotal = values.animals.reduce((total, animal) => {
    const minimumCategory = minimumTransportBoxCategory(animal)
    const requestedCategory = requestedCategoryFor(animal, minimumCategory)
    return (
      total +
      transportBoxPriceCents(
        requestedCategory,
        { weightKg: animal.weightKg, minimumCategory },
        boxCatalog,
      ) /
        100
    )
  }, 0)
  const routeStops = selectedRoute?.localities ?? []
  const destinationStops = values.origin
    ? routeStops.slice(routeStops.indexOf(values.origin) + 1)
    : []

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

  if (petsToSave) {
    const names = petsToSave.map((animal) => animal.name).join(' y ')
    return (
      <Card className="table-card client-request-card">
        <CardContent>
          <section className="payment-recovery">
            <div className="text-accent [&_p]:text-muted-foreground mb-3.75 flex items-start gap-2.25 [&_h2]:m-0 [&_h2]:text-lg [&_p]:mt-1 [&_p]:text-[13px] [&_p]:leading-5">
              <PawPrint size={17} />
              <div>
                <h2>Tu solicitud está enviada</h2>
                <p>
                  ¿Quieres guardar {names} para la próxima vez? Podrás cambiar peso y medidas
                  siempre que lo necesites.
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
                Ahora no
              </Button>
              <Button type="button" onClick={() => void savePets()} disabled={sending}>
                <PawPrint size={16} /> {sending ? 'Guardando…' : 'Guardar mascota'}
              </Button>
            </div>
          </section>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="table-card client-request-card">
      <CardContent>
        <form className="request-form" onSubmit={(event) => void submit(event)} noValidate>
          <div className="request-form-heading">
            <div>
              <h2>Organiza el viaje en cuatro pasos</h2>
              <p>Guardaremos tus datos para que puedas seguir el transporte desde aquí.</p>
            </div>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
          <ol className="request-steps" aria-label="Progreso de solicitud">
            {steps.map((label, index) => (
              <li
                key={label}
                className={index === step ? 'is-current' : index < step ? 'is-complete' : ''}
              >
                <span>{index < step ? <Check size={13} /> : index + 1}</span>
                {label}
              </li>
            ))}
          </ol>

          {step === 0 && (
            <section className="border-border bg-muted/20 rounded-xl border p-4 shadow-sm sm:p-5">
              <div className="mb-5 flex items-start gap-3">
                <span className="bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-full">
                  <ShieldCheck size={17} />
                </span>
                <div>
                  <h3 className="text-foreground text-base font-semibold">Datos de contacto</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Los usaremos para gestionar la reserva y resolver cualquier incidencia.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="request-contact-name">Nombre y apellidos</FieldLabel>
                  <Input
                    id="request-contact-name"
                    value={values.contactName}
                    onChange={(event) => setValues({ ...values, contactName: event.target.value })}
                    autoComplete="name"
                    placeholder="Tu nombre completo"
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
                    onChange={(event) => setValues({ ...values, contactPhone: event.target.value })}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="600 000 000"
                    className="min-h-11"
                    required
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="request-contact-email">Correo electrónico</FieldLabel>
                  <Input
                    id="request-contact-email"
                    type="email"
                    value={values.contactEmail}
                    onChange={(event) => setValues({ ...values, contactEmail: event.target.value })}
                    autoComplete="email"
                    placeholder="nombre@correo.com"
                    className="min-h-11"
                    required
                  />
                  <FieldDescription>
                    Aquí recibirás la información de tu solicitud.
                  </FieldDescription>
                </Field>
              </div>
              <div className="border-border mt-6 border-t pt-5">
                <div className="mb-4">
                  <h3 className="text-foreground text-base font-semibold">Datos para la factura</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Elige quién paga el transporte y completa sus datos fiscales. Se guardarán en el
                    CRM para que administración pueda emitir la factura.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="request-billing-payer">
                      ¿Quién paga el transporte?
                    </FieldLabel>
                    <select
                      id="request-billing-payer"
                      className="bg-background min-h-11 rounded-md border px-3 text-sm"
                      value={values.billingPayer}
                      onChange={(event) => selectBillingPayer(event.target.value as InvoicePayer)}
                    >
                      <option value="remitente">La persona que envía el animal</option>
                      <option value="destinatario">La persona que recibe el animal</option>
                      <option value="manual">Otra persona o empresa</option>
                    </select>
                  </Field>
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
                    <FieldLabel htmlFor="request-billing-city">Ciudad</FieldLabel>
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
                </div>
              </div>
            </section>
          )}

          {step === 1 && (
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
                      label: `${route.templateName || 'Ruta programada'} · ${new Date(`${route.serviceDate}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · ${route.routeDirection === 'inversa' ? 'sentido inverso' : 'sentido habitual'}`,
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
                    options={routeStops.slice(0, -1).map((stop) => ({ id: stop, label: stop }))}
                    disabled={!selectedRoute}
                  />
                </Field>
                <Field>
                  <FieldLabel>Entrega</FieldLabel>
                  <FormSelect
                    ariaLabel="Entrega"
                    value={values.destination}
                    onChange={(destination) =>
                      setValues((current) => ({ ...current, destination }))
                    }
                    placeholder="Selecciona una parada"
                    options={destinationStops.map((stop) => ({ id: stop, label: stop }))}
                    disabled={!values.origin}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="request-desired-date">Fecha de salida</FieldLabel>
                  <Input
                    id="request-desired-date"
                    type="date"
                    value={values.desiredDate}
                    readOnly
                    aria-readonly="true"
                    className="min-h-11"
                    required
                  />
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
                    {savedPets.length > 0 && (
                      <Field className="sm:col-span-2">
                        <FieldLabel>¿Ya has viajado con nosotros?</FieldLabel>
                        <FormSelect
                          ariaLabel="¿Ya has viajado con nosotros?"
                          value={animal.clientPetId ?? ''}
                          onChange={(petId) => selectSavedPet(index, petId)}
                          placeholder="Rellenar los datos a mano"
                          options={savedPets.map((pet) => ({
                            id: pet.id,
                            label: `${pet.name} · ${pet.species}`,
                          }))}
                        />
                        <FieldDescription>
                          Al elegirla rellenamos sus datos. Puedes cambiarlos antes de continuar.
                        </FieldDescription>
                      </Field>
                    )}
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
                      <Input
                        id={`animal-${animal.ordinal}-species`}
                        value={animal.species}
                        onChange={(event) => updateAnimal(index, { species: event.target.value })}
                        placeholder="Perro, gato…"
                        className="min-h-11"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`animal-${animal.ordinal}-breed`}>Raza</FieldLabel>
                      <Input
                        id={`animal-${animal.ordinal}-breed`}
                        value={animal.breed}
                        onChange={(event) => updateAnimal(index, { breed: event.target.value })}
                        placeholder="Opcional"
                        className="min-h-11"
                      />
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
                      <FieldLabel htmlFor={`animal-${animal.ordinal}-length`}>
                        Largo (cm)
                      </FieldLabel>
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
                    const minimumCategory = minimumTransportBoxCategory(animal)
                    const requestedCategory = requestedCategoryFor(animal, minimumCategory)
                    return (
                      <div className="mt-3 grid gap-3">
                        <p className="text-muted-foreground text-xs">
                          Recomendación automática: {transportBoxCategoryLabel(minimumCategory)} ·{' '}
                          {boxCatalog[minimumCategory].dimensions}
                        </p>
                        <Field>
                          <FieldLabel htmlFor={`animal-${animal.ordinal}-box-category`}>
                            Categoría de box
                          </FieldLabel>
                          <select
                            id={`animal-${animal.ordinal}-box-category`}
                            className="bg-background min-h-11 rounded-md border px-3 text-sm"
                            value={requestedCategory}
                            onChange={(event) =>
                              updateAnimal(index, {
                                requestedBoxCategory: event.target
                                  .value as TransportRequestAnimal['requestedBoxCategory'],
                              })
                            }
                          >
                            {transportBoxOptions(minimumCategory).map((category) => (
                              <option value={category} key={category}>
                                {transportBoxCategoryLabel(category)} ·{' '}
                                {currency(
                                  transportBoxPriceCents(
                                    category,
                                    { weightKg: animal.weightKg, minimumCategory },
                                    boxCatalog,
                                  ) / 100,
                                )}
                                {transportBoxCategoryRank(category) >
                                transportBoxCategoryRank(minimumCategory)
                                  ? ' · extra por comodidad'
                                  : ''}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    )
                  })()}
                </div>
              ))}
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
            </section>
          )}

          {step === 3 && (
            <section className="request-review border-border bg-muted/20 rounded-xl border p-4 shadow-sm sm:p-5">
              <div className="mb-5 flex items-start gap-3">
                <span className="bg-accent/10 text-accent flex size-9 shrink-0 items-center justify-center rounded-full">
                  <CreditCard size={17} />
                </span>
                <div>
                  <h3 className="text-foreground text-base font-semibold">Revisa y confirma</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Tu solicitud se enviará a operaciones después de registrar el pago.
                  </p>
                </div>
              </div>
              <div className="request-review-grid">
                <div>
                  <span>Contacto</span>
                  <strong>{values.contactName}</strong>
                  <small>
                    {values.contactPhone} · {values.contactEmail}
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
                  <span>Importe del transporte</span>
                  <strong>{currency(requestTotal)}</strong>
                  <small>Según el tamaño de cada box</small>
                </div>
              </div>
              <p className="payment-note">
                <ShieldCheck size={15} /> El pago queda registrado y la solicitud pasa directamente
                a revisión.
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
                <CreditCard size={16} /> {sending ? 'Registrando pago…' : 'Confirmar y pagar'}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
