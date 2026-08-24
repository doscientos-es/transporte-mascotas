export type AnimalSize = 'pequeno' | 'mediano' | 'grande'
export type LetterStatus = 'pendiente' | 'revisada' | 'en_ruta' | 'entregada'
export type NavSection = 'cartas' | 'reservas' | 'clientes' | 'plantillas' | 'rutas' | 'furgoneta'

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

export interface ClientInvoice {
  id: string
  letterId: string
  clientId: string
  payer: 'remitente' | 'destinatario' | 'third_party'
  concept: string
  total: number
  status: 'generado' | 'pagado'
  createdAt: string
}

export interface RouteStop {
  id: string
  locality: string
  place: string
  mapUrl: string
  minutes: number
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
}

export interface DailyRoute {
  id: string
  templateId: string
  date: string
  status: 'borrador' | 'activa' | 'completada'
  published?: boolean
  actions: ServiceAction[]
}
