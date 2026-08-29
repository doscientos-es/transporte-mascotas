import { Button, Card, CardContent } from '@doscientos/ui'
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
import { useState, type FormEvent } from 'react'

import type { ClientPet, TransportRequestAnimal, UpcomingRoute } from '@/shared/types'

export type RequestFormValues = {
  contactName: string
  contactPhone: string
  contactEmail: string
  origin: string
  destination: string
  desiredDate: string
  dailyRouteId: string
  notes: string
  animals: TransportRequestAnimal[]
}

const steps = ['Contacto', 'Trayecto', 'Mascotas', 'Revisar']
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

const initialValues = (
  contactName: string,
  contactPhone: string,
  contactEmail: string,
): RequestFormValues => ({
  contactName,
  contactPhone,
  contactEmail,
  origin: '',
  destination: '',
  desiredDate: '',
  dailyRouteId: '',
  notes: '',
  animals: [emptyAnimal(1)],
})

type Props = {
  routes: UpcomingRoute[]
  savedPets: ClientPet[]
  contactName: string
  contactPhone: string
  contactEmail: string
  onSubmit: (values: RequestFormValues) => Promise<void>
  onCancel: () => void
  onSavePets: (animals: TransportRequestAnimal[]) => Promise<void>
  pendingPayment?: boolean
  onRetryPayment?: () => Promise<void>
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
  pendingPayment = false,
  onRetryPayment,
}: Props) {
  const [values, setValues] = useState(() => initialValues(contactName, contactPhone, contactEmail))
  const [step, setStep] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [petsToSave, setPetsToSave] = useState<TransportRequestAnimal[] | null>(null)

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

  function validateCurrentStep() {
    if (step === 0) {
      if (!values.contactName.trim() || !values.contactPhone.trim() || !values.contactEmail.trim())
        return 'Completa los datos de contacto para poder avisarte.'
      if (!/^\S+@\S+\.\S+$/.test(values.contactEmail))
        return 'Escribe un correo electrónico válido.'
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
      await onSubmit(values)
      const newPets = values.animals.filter((animal) => !animal.clientPetId)
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
      setError('Tu solicitud está enviada, pero no hemos podido guardar la mascota. Vuelve a intentarlo.')
    } finally {
      setSending(false)
    }
  }

  const selectedRoute = routes.find((route) => route.id === values.dailyRouteId)
  const routeStops = selectedRoute?.localities ?? []
  const destinationStops = values.origin
    ? routeStops.slice(routeStops.indexOf(values.origin) + 1)
    : []

  function selectRoute(routeId: string) {
    const route = routes.find((item) => item.id === routeId)
    setValues((current) => ({
      ...current,
      dailyRouteId: routeId,
      desiredDate: route?.serviceDate ?? '',
      origin: '',
      destination: '',
    }))
  }

  if (pendingPayment) {
    return (
      <Card className="table-card client-request-card">
        <CardContent>
          <section className="payment-recovery">
            <div className="letter-form-section-title">
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
            <div className="letter-form-section-title">
              <PawPrint size={17} />
              <div>
                <h2>Tu solicitud está enviada</h2>
                <p>
                  ¿Quieres guardar {names} para la próxima vez? Podrás cambiar peso y medidas siempre que lo necesites.
                </p>
              </div>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="request-form-actions">
              <Button type="button" variant="outline" onClick={onCancel} disabled={sending}>Ahora no</Button>
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
        <form
          className="letter-form request-form"
          onSubmit={(event) => void submit(event)}
          noValidate
        >
          <div className="request-form-heading">
            <div>
              <span className="eyebrow">Nueva solicitud</span>
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
            <section className="letter-form-section">
              <div className="letter-form-section-title">
                <ShieldCheck size={17} />
                <div>
                  <h3>Cómo te contactamos</h3>
                  <p>Te avisaremos cuando revisemos la solicitud y asignemos la ruta.</p>
                </div>
              </div>
              <div className="letter-form-grid">
                <label>
                  Nombre y apellidos
                  <input
                    value={values.contactName}
                    onChange={(event) => setValues({ ...values, contactName: event.target.value })}
                    autoComplete="name"
                    required
                  />
                </label>
                <label>
                  Teléfono
                  <input
                    value={values.contactPhone}
                    onChange={(event) => setValues({ ...values, contactPhone: event.target.value })}
                    autoComplete="tel"
                    inputMode="tel"
                    required
                  />
                </label>
                <label className="form-span">
                  Correo electrónico
                  <input
                    type="email"
                    value={values.contactEmail}
                    onChange={(event) => setValues({ ...values, contactEmail: event.target.value })}
                    autoComplete="email"
                    required
                  />
                </label>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="letter-form-section">
              <div className="letter-form-section-title">
                <ArrowRight size={17} />
                <div>
                  <h3>Elige una salida publicada</h3>
                  <p>La fecha y las paradas disponibles dependen de la ruta seleccionada.</p>
                </div>
              </div>
              <div className="letter-form-grid">
                <label className="form-span">
                  Ruta y fecha
                  <select
                    value={values.dailyRouteId}
                    onChange={(event) => selectRoute(event.target.value)}
                    required
                  >
                    <option value="">Selecciona una salida</option>
                    {routes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.templateName || 'Ruta programada'} ·{' '}
                        {new Date(`${route.serviceDate}T12:00:00`).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}{' '}
                        ·{' '}
                        {route.routeDirection === 'inversa'
                          ? 'sentido inverso'
                          : 'sentido habitual'}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Recogida
                  <select
                    value={values.origin}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        origin: event.target.value,
                        destination: '',
                      }))
                    }
                    disabled={!selectedRoute}
                    required
                  >
                    <option value="">Selecciona una parada</option>
                    {routeStops.slice(0, -1).map((stop, index) => (
                      <option key={`${stop}-${index}`} value={stop}>
                        {stop}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Entrega
                  <select
                    value={values.destination}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, destination: event.target.value }))
                    }
                    disabled={!values.origin}
                    required
                  >
                    <option value="">Selecciona una parada</option>
                    {destinationStops.map((stop, index) => (
                      <option key={`${stop}-${index}`} value={stop}>
                        {stop}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fecha de salida
                  <input
                    type="date"
                    value={values.desiredDate}
                    readOnly
                    aria-readonly="true"
                    required
                  />
                </label>
                <label className="form-span">
                  Algo que debamos tener en cuenta
                  <input
                    value={values.notes}
                    onChange={(event) => setValues({ ...values, notes: event.target.value })}
                    placeholder="Opcional: horario, punto de encuentro, necesidades especiales…"
                  />
                </label>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="letter-form-section">
              <div className="letter-form-section-title">
                <PawPrint size={17} />
                <div>
                  <h3>Tu mascota</h3>
                  <p>Con estas medidas reservamos un espacio adecuado en la furgoneta.</p>
                </div>
              </div>
              {values.animals.map((animal, index) => (
                <div className="animal-form-card" key={animal.ordinal}>
                  <div>
                    <span>Mascota {index + 1}</span>
                    {values.animals.length > 1 && (
                      <button
                        type="button"
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
                      </button>
                    )}
                  </div>
                  <div className="letter-form-grid animal-fields">
                    {savedPets.length > 0 && (
                      <label className="form-span">
                        ¿Ya has viajado con nosotros?
                        <select value={animal.clientPetId ?? ''} onChange={(event) => selectSavedPet(index, event.target.value)}>
                          <option value="">Rellenar los datos a mano</option>
                          {savedPets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name} · {pet.species}</option>)}
                        </select>
                        <small>Al elegirla rellenamos sus datos. Puedes cambiarlos antes de continuar.</small>
                      </label>
                    )}
                    <label>
                      Nombre
                      <input value={animal.name} onChange={(event) => updateAnimal(index, { name: event.target.value })} placeholder="Por ejemplo, Luna" required />
                    </label>
                    <label>
                      Especie
                      <input
                        value={animal.species}
                        onChange={(event) => updateAnimal(index, { species: event.target.value })}
                        placeholder="Perro, gato…"
                        required
                      />
                    </label>
                    <label>
                      Raza
                      <input
                        value={animal.breed}
                        onChange={(event) => updateAnimal(index, { breed: event.target.value })}
                        placeholder="Opcional"
                      />
                    </label>
                    <label>
                      Peso (kg)
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={animal.weightKg || ''}
                        onChange={(event) =>
                          updateAnimal(index, { weightKg: Number(event.target.value) })
                        }
                        required
                      />
                    </label>
                    <label>
                      Largo (cm)
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={animal.lengthCm || ''}
                        onChange={(event) =>
                          updateAnimal(index, { lengthCm: Number(event.target.value) })
                        }
                        required
                      />
                    </label>
                    <label>
                      Alto (cm)
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={animal.heightCm || ''}
                        onChange={(event) =>
                          updateAnimal(index, { heightCm: Number(event.target.value) })
                        }
                        required
                      />
                    </label>
                    <label>
                      Ancho (cm)
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={animal.widthCm || ''}
                        onChange={(event) =>
                          updateAnimal(index, { widthCm: Number(event.target.value) })
                        }
                        required
                      />
                    </label>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="add-animal"
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
            <section className="letter-form-section request-review">
              <div className="letter-form-section-title">
                <CreditCard size={17} />
                <div>
                  <h3>Revisa y confirma</h3>
                  <p>Tu solicitud se enviará a operaciones después de registrar el pago.</p>
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
          <div className="request-form-actions">
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
