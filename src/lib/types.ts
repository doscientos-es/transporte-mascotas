export type AnimalSize = 'pequeno' | 'mediano' | 'grande'
export type LetterStatus = 'pendiente' | 'revisada' | 'en_ruta' | 'entregada'
export type AppRole = 'admin' | 'transportista' | 'cliente'
export type NavSection = 'cartas' | 'clientes' | 'plantillas' | 'rutas' | 'furgoneta' | 'facturas' | 'solicitudes' | 'proximas-rutas' | 'mis-transportes'

export interface UserProfile {
  displayName: string
  role: AppRole
}

export interface Transporter {
  id: string
  displayName: string
}

export interface Animal {
  id: string
  species: string
  breed: string
  size: AnimalSize
  box?: number
}

export interface Letter {
  id: string
  sender: string
  senderPhone: string
  recipient: string
  recipientPhone: string
  origin: string
  destination: string
  route: string
  serviceDate: string
  status: LetterStatus
  animals: Animal[]
  importedAt: string
  extractionEmail?: string
}

export interface LetterDraft {
  reference: string
  routeId: string
  sender: string
  senderPhone: string
  recipient: string
  recipientPhone: string
  origin: string
  destination: string
  animals: Array<Omit<Animal, 'id'>>
}

export interface Client {
  id: string
  fullName: string
  nif: string
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
  createdAt: string
}

export type InvoicePayer = 'remitente' | 'destinatario' | 'manual'
export type InvoiceClientInput = Omit<Client, 'id' | 'createdAt'>
export type PaymentDeliveryChannel = 'manual' | 'email' | 'whatsapp' | 'both'

export interface PaymentDelivery {
  channel: PaymentDeliveryChannel
  email: string
  phone: string
}

export interface ClientInvoice {
  id: string
  letterId: string
  clientId: string
  payer: InvoicePayer
  concept: string
  total: number
  status: 'solicitud_pago' | 'emitida'
  createdAt: string
}

export interface RouteStop {
  id: string
  locality: string
  place: string
  mapUrl: string
  minutes: number
}

export type DailyStopKind = 'parada' | 'recogida' | 'entrega'
export type RouteDirection = 'normal' | 'inversa'

export interface DailyRouteStop extends RouteStop {
  kind: DailyStopKind
  dwellMinutes: number
}

export interface RouteTemplate {
  id: string
  name: string
  color: string
  stops: RouteStop[]
}

export interface ServiceAction {
  id: string
  letterId: string
  animalId: string
  type: 'recogida' | 'entrega'
  stop: string
  customer: string
  phone: string
  status: 'pendiente' | 'completada' | 'incidencia'
  box?: number
  stopId?: string
  dwellMinutes?: number
  animalLabel?: string
}

export interface DailyRoute {
  id: string
  templateId: string
  date: string
  status: 'borrador' | 'activa' | 'completada'
  transporterId?: string
  direction?: RouteDirection
  actions: ServiceAction[]
  stops?: DailyRouteStop[]
}

export type TransportRequestStatus = 'pago_pendiente' | 'por_verificar' | 'confirmada' | 'rechazada' | 'en_ruta' | 'entregada' | 'cancelada'

export interface TransportRequestAnimal {
  id?: string
  ordinal: number
  species: string
  breed: string
  weightKg: number
  lengthCm: number
  heightCm: number
  widthCm: number
  size?: AnimalSize
}

export interface TransportRequest {
  id: string
  requesterId: string
  contactName: string
  contactPhone: string
  contactEmail: string
  origin: string
  destination: string
  desiredDate: string
  notes: string
  status: TransportRequestStatus
  paymentReference: string
  paidAt?: string
  adminNote: string
  createdAt: string
  animals: TransportRequestAnimal[]
}

export interface UpcomingRoute {
  id: string
  serviceDate: string
  routeDirection: RouteDirection
  templateName: string
  templateColor: string
  localities: string[]
}
