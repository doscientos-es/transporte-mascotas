import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, ArrowRight, Check, CreditCard, PawPrint, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { TransportRequestAnimal } from '../lib/types'

export type RequestFormValues = {
  contactName: string
  contactPhone: string
  contactEmail: string
  origin: string
  destination: string
  desiredDate: string
  notes: string
  animals: TransportRequestAnimal[]
}

const steps = ['Contacto', 'Trayecto', 'Mascotas', 'Revisar']
const emptyAnimal = (ordinal: number): TransportRequestAnimal => ({ ordinal, species: '', breed: '', weightKg: 0, lengthCm: 0, heightCm: 0, widthCm: 0 })
const today = new Date().toISOString().slice(0, 10)

const initialValues = (contactName: string, contactEmail: string): RequestFormValues => ({
  contactName, contactPhone: '', contactEmail, origin: '', destination: '', desiredDate: '', notes: '', animals: [emptyAnimal(1)],
})

type Props = { contactName: string; contactEmail: string; onSubmit: (values: RequestFormValues) => Promise<void>; onCancel: () => void }

export function ClientRequestForm({ contactName, contactEmail, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState(() => initialValues(contactName, contactEmail))
  const [step, setStep] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  function updateAnimal(index: number, patch: Partial<TransportRequestAnimal>) {
    setValues((current) => ({ ...current, animals: current.animals.map((animal, position) => position === index ? { ...animal, ...patch } : animal) }))
  }

  function validateCurrentStep() {
    if (step === 0) {
      if (!values.contactName.trim() || !values.contactPhone.trim() || !values.contactEmail.trim()) return 'Completa los datos de contacto para poder avisarte.'
      if (!/^\S+@\S+\.\S+$/.test(values.contactEmail)) return 'Escribe un correo electrónico válido.'
    }
    if (step === 1) {
      if (!values.origin.trim() || !values.destination.trim() || !values.desiredDate) return 'Indica recogida, entrega y fecha para continuar.'
      if (values.desiredDate < today) return 'Elige una fecha a partir de hoy.'
    }
    if (step === 2) {
      const incompleteAnimal = values.animals.some((animal) => !animal.species.trim() || animal.weightKg <= 0 || animal.lengthCm <= 0 || animal.heightCm <= 0 || animal.widthCm <= 0)
      if (incompleteAnimal) return 'Completa especie, peso y medidas de cada mascota.'
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
      setValues(initialValues(contactName, contactEmail))
      setStep(0)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No hemos podido registrar la solicitud.')
    } finally {
      setSending(false)
    }
  }

  return <Card className="table-card client-request-card"><CardContent><form className="letter-form request-form" onSubmit={submit} noValidate>
    <div className="request-form-heading"><div><span className="eyebrow">Nueva solicitud</span><h2>Organiza el viaje en cuatro pasos</h2><p>Guardaremos tus datos para que puedas seguir el transporte desde aquí.</p></div><Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button></div>
    <ol className="request-steps" aria-label="Progreso de solicitud">{steps.map((label, index) => <li key={label} className={index === step ? 'is-current' : index < step ? 'is-complete' : ''}><span>{index < step ? <Check size={13} /> : index + 1}</span>{label}</li>)}</ol>

    {step === 0 && <section className="letter-form-section">
      <div className="letter-form-section-title"><ShieldCheck size={17} /><div><h3>Cómo te contactamos</h3><p>Te avisaremos cuando revisemos la solicitud y asignemos la ruta.</p></div></div>
      <div className="letter-form-grid">
        <label>Nombre y apellidos<input value={values.contactName} onChange={(event) => setValues({ ...values, contactName: event.target.value })} autoComplete="name" required /></label>
        <label>Teléfono<input value={values.contactPhone} onChange={(event) => setValues({ ...values, contactPhone: event.target.value })} autoComplete="tel" inputMode="tel" required /></label>
        <label className="form-span">Correo electrónico<input type="email" value={values.contactEmail} onChange={(event) => setValues({ ...values, contactEmail: event.target.value })} autoComplete="email" required /></label>
      </div>
    </section>}

    {step === 1 && <section className="letter-form-section">
      <div className="letter-form-section-title"><ArrowRight size={17} /><div><h3>El trayecto que necesitas</h3><p>Escribe las localidades o direcciones de recogida y entrega.</p></div></div>
      <div className="letter-form-grid">
        <label>Recogida<input value={values.origin} onChange={(event) => setValues({ ...values, origin: event.target.value })} placeholder="Ej. Barcelona" required /></label>
        <label>Entrega<input value={values.destination} onChange={(event) => setValues({ ...values, destination: event.target.value })} placeholder="Ej. Valencia" required /></label>
        <label>Fecha preferida<input type="date" value={values.desiredDate} min={today} onChange={(event) => setValues({ ...values, desiredDate: event.target.value })} required /></label>
        <label className="form-span">Algo que debamos tener en cuenta<input value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} placeholder="Opcional: horario, punto de encuentro, necesidades especiales…" /></label>
      </div>
    </section>}

    {step === 2 && <section className="letter-form-section">
      <div className="letter-form-section-title"><PawPrint size={17} /><div><h3>Tu mascota</h3><p>Con estas medidas reservamos un espacio adecuado en la furgoneta.</p></div></div>
      {values.animals.map((animal, index) => <div className="animal-form-card" key={animal.ordinal}>
        <div><span>Mascota {index + 1}</span>{values.animals.length > 1 && <button type="button" onClick={() => setValues({ ...values, animals: values.animals.filter((_, position) => position !== index).map((item, position) => ({ ...item, ordinal: position + 1 })) })}><Trash2 size={14} /> Quitar</button>}</div>
        <div className="letter-form-grid animal-fields">
          <label>Especie<input value={animal.species} onChange={(event) => updateAnimal(index, { species: event.target.value })} placeholder="Perro, gato…" required /></label>
          <label>Raza<input value={animal.breed} onChange={(event) => updateAnimal(index, { breed: event.target.value })} placeholder="Opcional" /></label>
          <label>Peso (kg)<input type="number" min="0.1" step="0.1" value={animal.weightKg || ''} onChange={(event) => updateAnimal(index, { weightKg: Number(event.target.value) })} required /></label>
          <label>Largo (cm)<input type="number" min="1" step="1" value={animal.lengthCm || ''} onChange={(event) => updateAnimal(index, { lengthCm: Number(event.target.value) })} required /></label>
          <label>Alto (cm)<input type="number" min="1" step="1" value={animal.heightCm || ''} onChange={(event) => updateAnimal(index, { heightCm: Number(event.target.value) })} required /></label>
          <label>Ancho (cm)<input type="number" min="1" step="1" value={animal.widthCm || ''} onChange={(event) => updateAnimal(index, { widthCm: Number(event.target.value) })} required /></label>
        </div>
      </div>)}
      <Button type="button" variant="outline" className="add-animal" onClick={() => setValues({ ...values, animals: [...values.animals, emptyAnimal(values.animals.length + 1)] })}><Plus size={15} /> Añadir otra mascota</Button>
    </section>}

    {step === 3 && <section className="letter-form-section request-review">
      <div className="letter-form-section-title"><CreditCard size={17} /><div><h3>Revisa y confirma</h3><p>Tu solicitud se enviará a operaciones después de registrar el pago.</p></div></div>
      <div className="request-review-grid"><div><span>Contacto</span><strong>{values.contactName}</strong><small>{values.contactPhone} · {values.contactEmail}</small></div><div><span>Trayecto</span><strong>{values.origin} → {values.destination}</strong><small>{new Date(`${values.desiredDate}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</small></div><div><span>Mascotas</span><strong>{values.animals.length} mascota{values.animals.length === 1 ? '' : 's'}</strong><small>{values.animals.map((animal) => animal.species).join(' · ')}</small></div></div>
      <p className="payment-note"><ShieldCheck size={15} /> El pago queda registrado y la solicitud pasa directamente a revisión.</p>
    </section>}

    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="request-form-actions">{step > 0 ? <Button type="button" variant="outline" onClick={() => { setError(''); setStep((current) => current - 1) }}><ArrowLeft size={16} /> Atrás</Button> : <span />}{step < steps.length - 1 ? <Button type="button" onClick={next}>Continuar <ArrowRight size={16} /></Button> : <Button type="submit" disabled={sending}><CreditCard size={16} /> {sending ? 'Registrando pago…' : 'Confirmar y pagar'}</Button>}</div>
  </form></CardContent></Card>
}
