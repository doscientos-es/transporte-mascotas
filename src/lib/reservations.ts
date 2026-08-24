import { supabase } from './supabase'
import type { AnimalSize } from './types'

export type PublicRoute = { id: string; name: string; date: string; stops: Array<{ id: string; sequence: number; locality: string; meetingPoint: string; mapUrl: string }> }
export type ReservationInput = { routeId: string; originStopId: string; destinationStopId: string; sender: Record<string, string>; recipient: Record<string, string>; animal: { species: string; breed: string; size: AnimalSize; weightKg: number; microchip: string }; requestedCategory: AnimalSize; recommendedCategory: AnimalSize; amount: number; notes?: string }

function timeout<T>(operation: PromiseLike<T>, message: string, milliseconds = 10000): Promise<T> {
  return Promise.race([
    Promise.resolve(operation),
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(message)), milliseconds)),
  ])
}

export async function loadPublicRoutes(): Promise<PublicRoute[]> {
  if (!supabase) return []
  const { data, error } = await timeout(supabase.from('daily_routes').select('id,service_date,route_templates(name),daily_route_stops(id,locality,meeting_point,map_url,sequence,active)').eq('published', true).in('status', ['borrador', 'activa']).gte('service_date', new Date().toISOString().slice(0, 10)).order('service_date'), 'La conexión con las rutas está tardando demasiado. Inténtalo de nuevo.')
  if (error) throw error
  return (data ?? []).map((row: any) => ({ id: row.id, name: row.route_templates?.name ?? 'Ruta', date: row.service_date, stops: (row.daily_route_stops ?? []).filter((stop: any) => stop.active).toSorted((a: any, b: any) => a.sequence - b.sequence).map((stop: any) => ({ id: stop.id, sequence: stop.sequence, locality: stop.locality, meetingPoint: stop.meeting_point, mapUrl: stop.map_url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.locality)}` })) }))
}

export async function submitReservation(input: ReservationInput) {
  if (!supabase) throw new Error('Las reservas públicas requieren configurar Supabase.')
  const { data, error } = await supabase.rpc('submit_public_reservation', {
    p_daily_route_id: input.routeId, p_sender: input.sender, p_recipient: input.recipient, p_animal: input.animal,
    p_origin_stop_id: input.originStopId, p_destination_stop_id: input.destinationStopId,
    p_requested_category: input.requestedCategory, p_recommended_category: input.recommendedCategory,
    p_quoted_amount: input.amount, p_notes: input.notes ?? '',
  })
  if (error) throw error
  return data as string
}
