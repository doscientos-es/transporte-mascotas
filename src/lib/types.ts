export type AnimalSize = 'pequeno' | 'mediano' | 'grande'
export type LetterStatus = 'pendiente' | 'revisada' | 'en_ruta' | 'entregada'
export type AppRole = 'admin' | 'transportista'
export type NavSection = 'cartas' | 'clientes' | 'plantillas' | 'rutas' | 'furgoneta' | 'facturas'

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

export interface ClientInvoice {
  id: string
  letterId: string
  clientId: string
  payer: InvoicePayer
  concept: string
  total: number
  status: 'generado' | 'pagada'
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
  actions: ServiceAction[]
  stops?: DailyRouteStop[]
}
