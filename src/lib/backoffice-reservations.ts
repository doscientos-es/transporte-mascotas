import { supabase } from './supabase'

export type BackofficeReservation = { id: string; reference: string; status: string; paymentStatus: string; amount: number; routeName: string; date: string; senderName: string; recipientName: string; animal: string; createdAt: string }

export async function loadBackofficeReservations(): Promise<BackofficeReservation[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('reservations').select('id,public_reference,status,payment_status,quoted_amount,sender,recipient,animal,created_at,daily_routes(service_date,route_templates(name))').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row: any) => ({ id: row.id, reference: row.public_reference, status: row.status, paymentStatus: row.payment_status, amount: Number(row.quoted_amount), routeName: row.daily_routes?.route_templates?.name ?? 'Ruta', date: row.daily_routes?.service_date ?? '', senderName: row.sender?.name ?? 'Sin nombre', recipientName: row.recipient?.name ?? 'Sin nombre', animal: row.animal?.breed || row.animal?.species || 'Mascota', createdAt: row.created_at }))
}

export async function confirmReservationPayment(id: string) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const client = supabase
  const { error } = await client.rpc('confirm_reservation_payment', { p_reservation_id: id })
  if (error) throw error
  const generated = await client.functions.invoke('generate-documents', { body: { reservationId: id } })
  if (generated.error) throw generated.error
  const dispatched = await client.functions.invoke('dispatch-reservation-deliveries', { body: { reservationId: id } })
  if (dispatched.error || !dispatched.data?.ok) {
    throw new Error('La reserva se confirmó, pero alguna comunicación quedó pendiente de reintento.')
  }
}
