import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, MapPin, PawPrint, ShieldCheck } from 'lucide-react'
import { allowedCategories, loadPricingRules, priceFor, recommendCategory, type PricingRule } from '../lib/pricing'
import { loadPublicRoutes, submitReservation, type PublicRoute } from '../lib/reservations'
import type { AnimalSize } from '../lib/types'
import '../App.css'

const labels: Record<AnimalSize, string> = { pequeno: 'Pequeño', mediano: 'Mediano', grande: 'Grande' }
const emptyParty = { name: '', phone: '', email: '', address: '', city: '', postalCode: '' }

export function ReservationPage() {
  const [routes, setRoutes] = useState<PublicRoute[]>([])
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([])
  const [routeId, setRouteId] = useState('')
  const [sender, setSender] = useState(emptyParty)
  const [recipient, setRecipient] = useState(emptyParty)
  const [animal, setAnimal] = useState({ species: 'Perro', breed: '', size: 'mediano' as AnimalSize, weightKg: '', microchip: '' })
  const [originStopId, setOriginStopId] = useState('')
  const [destinationStopId, setDestinationStopId] = useState('')
  const [category, setCategory] = useState<AnimalSize>('mediano')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const route = routes.find((item) => item.id === routeId)
  const originStop = route?.stops.find((stop) => stop.id === originStopId)
  const recommended = useMemo(() => recommendCategory(Number(animal.weightKg) || 0, animal.size, pricingRules.length ? pricingRules : undefined), [animal.size, animal.weightKg, pricingRules])
  const choices = allowedCategories(recommended)

  useEffect(() => { Promise.all([loadPublicRoutes(), loadPricingRules()]).then(([items, rules]) => { setRoutes(items); setPricingRules(rules); setRouteId(items[0]?.id ?? '') }).catch(() => setMessage('No se han podido cargar las rutas disponibles.')).finally(() => setLoading(false)) }, [])
  useEffect(() => { if (!choices.includes(category)) setCategory(recommended) }, [recommended, category, choices])
  useEffect(() => { if (originStop && route?.stops.find((stop) => stop.id === destinationStopId && stop.sequence <= originStop.sequence)) setDestinationStopId('') }, [destinationStopId, originStop, route])

  const updateParty = (which: 'sender' | 'recipient', field: keyof typeof emptyParty, value: string) => which === 'sender' ? setSender((current) => ({ ...current, [field]: value })) : setRecipient((current) => ({ ...current, [field]: value }))
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage('')
    if (!route || originStopId === destinationStopId) return setMessage('Elige puntos de encuentro de origen y destino distintos.')
    try {
      const id = await submitReservation({ routeId: route.id, originStopId, destinationStopId, sender, recipient, animal: { ...animal, weightKg: Number(animal.weightKg) }, requestedCategory: category, recommendedCategory: recommended, amount: priceFor(category, pricingRules.length ? pricingRules : undefined), notes })
      setMessage(`Reserva ${id.slice(0, 8).toUpperCase()} recibida. Te contactaremos para confirmar el cobro y el transporte.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se ha podido enviar la reserva.') }
  }

  const activeRules = pricingRules.length ? pricingRules : undefined
  return <main className="booking-shell"><header className="booking-header"><a href="/" className="booking-brand"><img src="/icon-192.png" alt="Kache Envíos" /><span>Kache Envíos<small>Transporte de mascotas</small></span></a><span><ShieldCheck size={16} /> Reserva segura</span></header><section className="booking-hero"><p className="eyebrow">RESERVA TU TRANSPORTE</p><h1>Tu mascota, acompañada en cada tramo.</h1><p>Elige una ruta disponible, indícanos sus datos y revisaremos la reserva antes de confirmar el cobro.</p></section>{message && <p className="booking-message" role="status"><CheckCircle2 size={18} /> {message}</p>}{loading ? <p className="booking-loading">Cargando rutas disponibles…</p> : !routes.length ? <p className="booking-loading">No hay rutas publicadas en este momento. Contacta con Kache Envíos para organizar tu transporte.</p> : <form className="booking-form" onSubmit={submit}><section><h2>1. Elige tu ruta</h2><div className="route-choice-grid">{routes.map((item) => <button type="button" key={item.id} onClick={() => { setRouteId(item.id); setOriginStopId(''); setDestinationStopId('') }} className={routeId === item.id ? 'is-selected' : ''}><strong>{item.name}</strong><span>{new Date(`${item.date}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span><small>{item.stops.length} puntos de encuentro</small></button>)}</div>{route && <div className="booking-stops">{route.stops.map((stop, index) => <a key={stop.id} href={stop.mapUrl} target="_blank" rel="noreferrer"><b>{index + 1}</b><span>{stop.locality}<small>{stop.meetingPoint}</small></span><MapPin size={16} /></a>)}</div>}</section><section><h2>2. Datos del transporte</h2><div className="booking-grid">{(['sender', 'recipient'] as const).map((which) => <fieldset key={which}><legend>{which === 'sender' ? 'Remitente' : 'Destinatario'}</legend>{Object.entries({ name: 'Nombre completo', phone: 'Teléfono', email: 'Email', address: 'Dirección', city: 'Ciudad', postalCode: 'Código postal' }).map(([field, label]) => <label key={field}>{label}<input required={field !== 'email' && field !== 'postalCode'} type={field === 'email' ? 'email' : 'text'} value={(which === 'sender' ? sender : recipient)[field as keyof typeof emptyParty]} onChange={(event) => updateParty(which, field as keyof typeof emptyParty, event.target.value)} /></label>)}</fieldset>)}</div><div className="booking-grid"><label>Punto de recogida<select required value={originStopId} onChange={(event) => setOriginStopId(event.target.value)}><option value="">Selecciona un punto</option>{route?.stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.locality} — {stop.meetingPoint}</option>)}</select></label><label>Punto de entrega<select required value={destinationStopId} onChange={(event) => setDestinationStopId(event.target.value)}><option value="">Selecciona un punto</option>{route?.stops.filter((stop) => !originStop || stop.sequence > originStop.sequence).map((stop) => <option key={stop.id} value={stop.id}>{stop.locality} — {stop.meetingPoint}</option>)}</select></label></div></section><section><h2>3. Tu mascota</h2><div className="booking-grid"><label>Especie<input value={animal.species} onChange={(event) => setAnimal({ ...animal, species: event.target.value })} /></label><label>Raza<input required value={animal.breed} onChange={(event) => setAnimal({ ...animal, breed: event.target.value })} /></label><label>Tamaño<select value={animal.size} onChange={(event) => setAnimal({ ...animal, size: event.target.value as AnimalSize })}><option value="pequeno">Pequeño</option><option value="mediano">Mediano</option><option value="grande">Grande</option></select></label><label>Peso aproximado (kg)<input required min="0.1" step="0.1" type="number" value={animal.weightKg} onChange={(event) => setAnimal({ ...animal, weightKg: event.target.value })} /></label><label>Número de microchip<input required value={animal.microchip} onChange={(event) => setAnimal({ ...animal, microchip: event.target.value })} /></label><label>Notas<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observaciones relevantes" /></label></div><div className="price-box"><PawPrint size={22} /><div><span>Espacio recomendado: {labels[recommended]}</span><strong>{priceFor(category, activeRules).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</strong></div><label>Categoría<select value={category} onChange={(event) => setCategory(event.target.value as AnimalSize)}>{choices.map((item) => <option key={item} value={item}>{labels[item]} — {priceFor(item, activeRules).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</option>)}</select></label></div></section><footer><p>No realizamos cobros online. Recibirás la confirmación y las instrucciones de pago tras revisar la solicitud.</p><button type="submit">Enviar solicitud de reserva</button></footer></form>}</main>
}
