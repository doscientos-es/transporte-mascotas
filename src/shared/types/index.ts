export type AnimalSize = 'pequeno' | 'mediano' | 'grande'
export type LetterStatus = 'pendiente' | 'revisada' | 'en_ruta' | 'entregada'
export type AppRole = 'admin' | 'transportista' | 'user'
export type AccompanyingDocument =
  | 'cartilla_sanitaria'
  | 'microchip'
  | 'pasaporte'
  | 'tatuaje'
  | 'anillo'
  | 'cites'
  | 'otro'
export type NavSection =
  | 'cartas'
  | 'clientes'
  | 'plantillas'
  | 'rutas'
  | 'furgoneta'
  | 'facturas'
  | 'solicitudes'
  | 'ajustes'
  | 'whatsapp-test'
  | 'proximas-rutas'
  | 'mis-transportes'
  | 'mis-mascotas'

export type DashboardNavigation = {
  section: NavSection
  routeId?: string
  hrefForSection: (section: NavSection) => string
  navigateToSection: (section: NavSection) => void
  navigateToRoute: (routeId: string) => void
  navigateToVan: (routeId: string) => void
  replaceWithSection: (section: NavSection) => void
}

export const isClientRole = (role: AppRole) => role === 'user'

export interface UserProfile {
  displayName: string
  phone: string
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
  birthDate: string
  weightKg: number
  lengthCm: number
  heightCm: number
  widthCm: number
  size: AnimalSize
  box?: number
}

export interface Letter {
  id: string
  sender: string
  senderPhone: string
  senderEmail: string
  senderNif: string
  senderAddress: string
  senderPostalCode: string
  senderCity: string
  senderProvince: string
  recipient: string
  recipientPhone: string
  recipientEmail: string
  recipientNif: string
  recipientAddress: string
  recipientPostalCode: string
  recipientCity: string
  recipientProvince: string
  origin: string
  destination: string
  originPoint: string
  destinationPoint: string
  originLatitude?: number
  originLongitude?: number
  destinationLatitude?: number
  destinationLongitude?: number
  accompanyingDocuments: AccompanyingDocument[]
  billingPayer: InvoicePayer
  billingClient: InvoiceClientInput
  route: string
  serviceDate: string
  status: LetterStatus
  animals: Animal[]
  importedAt: string
  extractionEmail?: string
  signedAt?: string
}

export interface LetterDraft {
  reference: string
  routeId: string
  sender: string
  senderPhone: string
  senderEmail: string
  senderNif: string
  senderAddress: string
  senderPostalCode: string
  senderCity: string
  senderProvince: string
  recipient: string
  recipientPhone: string
  recipientEmail: string
  recipientNif: string
  recipientAddress: string
  recipientPostalCode: string
  recipientCity: string
  recipientProvince: string
  origin: string
  destination: string
  originPoint: string
  destinationPoint: string
  accompanyingDocuments: AccompanyingDocument[]
  billingPayer: InvoicePayer
  otherPayer: InvoiceClientInput
  signatureConfirmed: boolean
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

export interface PaginatedResult<Item> {
  items: Item[]
  total: number
}

export type InvoicePayer = 'remitente' | 'destinatario' | 'manual'
export type InvoiceClientInput = Omit<Client, 'id' | 'createdAt'>

export interface PaymentDelivery {
  phone: string
}

export type ManualPaymentMethod = 'Transferencia' | 'Bizum' | 'Tarjeta'

export interface InvoiceFiscalSnapshot {
  number?: string
  issuer?: { name?: string; taxId?: string; address?: string }
  client?: {
    fullName?: string
    nif?: string
    address?: string
    city?: string
    postalCode?: string
    email?: string
    phone?: string
  }
  concept?: string
  net_amount?: number
  vat_rate?: number
  vat_amount?: number
  total_amount?: number
  payment_method?: string
  payment_date?: string
  operation_date?: string
}

export interface IssuedInvoice {
  id: string
  invoiceDraftId: string
  number: string
  issuedAt: string
  fiscalSnapshot: InvoiceFiscalSnapshot
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
  clientName: string
  clientNif?: string
  issuedInvoice?: IssuedInvoice
}

export interface RouteStop {
  id: string
  locality: string
  place: string
  mapUrl: string
  minutes: number
  alias?: string
  street?: string
  streetNumber?: string
  floor?: string
  postalCode?: string
  province?: string
  country?: string
  latitude?: number
  longitude?: number
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
  status: 'borrador' | 'activa' | 'completada' | 'cancelada'
  transporterId?: string
  direction?: RouteDirection
  actions: ServiceAction[]
  stops?: DailyRouteStop[]
}

export type TransportRequestStatus =
  | 'pago_pendiente'
  | 'por_verificar'
  | 'confirmada'
  | 'rechazada'
  | 'en_ruta'
  | 'entregada'
  | 'cancelada'

export interface TransportRequestAnimal {
  id?: string
  name: string
  ordinal: number
  species: string
  breed: string
  weightKg: number
  lengthCm: number
  heightCm: number
  widthCm: number
  size?: AnimalSize
  clientPetId?: string
}

export interface ClientPet {
  id: string
  name: string
  species: string
  breed: string
  weightKg: number
  lengthCm: number
  heightCm: number
  widthCm: number
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
  dailyRouteId: string
  originLatitude?: number
  originLongitude?: number
  destinationLatitude?: number
  destinationLongitude?: number
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
  stops: Array<Pick<RouteStop, 'id' | 'locality' | 'latitude' | 'longitude'>>
}
