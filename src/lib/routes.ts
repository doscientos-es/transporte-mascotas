import { supabase } from './supabase'
import type { RouteTemplate } from './types'
import type { DailyRoute } from './types'

type TemplateRow = { id: string; name: string; color: string; route_template_stops: Array<{ id: string; sequence: number; locality: string; meeting_point: string; map_url: string | null; minutes_to_next: number | null }> }

function mapTemplate(row: TemplateRow): RouteTemplate {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    stops: row.route_template_stops.toSorted((a, b) => a.sequence - b.sequence).map((stop) => ({
      id: stop.id,
      locality: stop.locality,
      place: stop.meeting_point,
      mapUrl: stop.map_url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.locality)}`,
      minutes: stop.minutes_to_next ?? 0,
    })),
  }
}

export async function loadOrSeedRouteTemplates(source: RouteTemplate[]) {
  if (!supabase) return source
  const { data: existing, error: readError } = await supabase
    .from('route_templates')
    .select('id,name,color,route_template_stops(id,sequence,locality,meeting_point,map_url,minutes_to_next)')
    .order('name')
  if (readError) throw readError
  if (existing.length) return (existing as TemplateRow[]).map(mapTemplate)

  const { data: inserted, error: insertError } = await supabase.from('route_templates')
    .insert(source.map((template) => ({ name: template.name, color: template.color })))
    .select('id,name,color')
  if (insertError) throw insertError
  const stops = source.flatMap((template) => {
    const insertedTemplate = inserted.find((item) => item.name === template.name)
    if (!insertedTemplate) return []
    return template.stops.map((stop, index) => ({
      route_template_id: insertedTemplate.id,
      sequence: index + 1,
      locality: stop.locality,
      meeting_point: stop.place,
      map_url: stop.mapUrl,
      minutes_to_next: stop.minutes || null,
    }))
  })
  const { error: stopError } = await supabase.from('route_template_stops').insert(stops)
  if (stopError) throw stopError
  return loadOrSeedRouteTemplates(source)
}

export async function loadRouteTemplates(): Promise<RouteTemplate[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('route_templates').select('id,name,color,route_template_stops(id,sequence,locality,meeting_point,map_url,minutes_to_next)').eq('active', true).order('name')
  if (error) throw error
  return (data as TemplateRow[] ?? []).map(mapTemplate)
}

export async function loadDailyRoutes(): Promise<DailyRoute[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('daily_routes').select('id,route_template_id,service_date,status,published,daily_route_stops(locality,route_actions(id,letter_id,animal_id,action_type,status,carriage_letters(sender_name,sender_phone,recipient_name,recipient_phone),van_assignments(box_number)))').order('service_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((route: any) => ({ id: route.id, templateId: route.route_template_id ?? '', date: route.service_date, status: route.status, published: route.published, actions: (route.daily_route_stops ?? []).flatMap((stop: any) => (stop.route_actions ?? []).map((action: any) => {
    const letter = action.carriage_letters
    const pickup = action.action_type === 'recogida'
    return { id: action.id, letterId: action.letter_id, animalId: action.animal_id, type: action.action_type, stop: stop.locality, customer: pickup ? letter?.sender_name ?? '' : letter?.recipient_name ?? '', phone: pickup ? letter?.sender_phone ?? '' : letter?.recipient_phone ?? '', status: action.status, box: action.van_assignments?.[0]?.box_number }
  })) }))
}

export async function saveDailyRoute(route: DailyRoute, template: RouteTemplate, userId: string) {
  if (!supabase) return
  const { error: routeError } = await supabase.from('daily_routes').insert({
    id: route.id,
    route_template_id: template.id,
    service_date: route.date,
    status: route.status,
    created_by: userId,
  })
  if (routeError) throw routeError
  const { data: savedStops, error: stopsError } = await supabase.from('daily_route_stops').insert(template.stops.map((stop, index) => ({
    daily_route_id: route.id,
    template_stop_id: stop.id,
    sequence: index + 1,
    locality: stop.locality,
    meeting_point: stop.place,
    map_url: stop.mapUrl,
    minutes_to_next: stop.minutes || null,
  }))).select('id,locality')
  if (stopsError) throw stopsError

  const letterIds = [...new Set(route.actions.map((action) => action.letterId))]
  if (!letterIds.length) return
  const { data: storedLetters, error: lettersError } = await supabase.from('carriage_letters').select('id').in('id', letterIds)
  if (lettersError) throw lettersError
  const allowedLetters = new Set(storedLetters.map((letter) => letter.id))
  const stopIds = new Map(savedStops.map((stop) => [stop.locality, stop.id]))
  const actions = route.actions.filter((action) => allowedLetters.has(action.letterId) && stopIds.has(action.stop)).map((action) => ({
    id: action.id,
    daily_route_id: route.id,
    daily_route_stop_id: stopIds.get(action.stop),
    letter_id: action.letterId,
    animal_id: action.animalId,
    action_type: action.type,
    status: action.status,
  }))
  if (!actions.length) return
  const { error: actionsError } = await supabase.from('route_actions').insert(actions)
  if (actionsError) throw actionsError

  const byAnimal = new Map<string, DailyRoute['actions']>()
  route.actions.forEach((action) => byAnimal.set(action.animalId, [...(byAnimal.get(action.animalId) ?? []), action]))
  for (const animalActions of byAnimal.values()) {
    const pickup = animalActions.find((action) => action.type === 'recogida' && action.box && allowedLetters.has(action.letterId))
    const delivery = animalActions.find((action) => action.type === 'entrega' && action.box && allowedLetters.has(action.letterId))
    if (!pickup || !delivery || !pickup.box) continue
    const pickupSequence = template.stops.findIndex((stop) => stop.locality === pickup.stop) + 1
    const deliverySequence = template.stops.findIndex((stop) => stop.locality === delivery.stop) + 1
    if (!pickupSequence || !deliverySequence) continue
    const { error: assignmentError } = await supabase.rpc('assign_van_box', {
      p_daily_route_id: route.id,
      p_animal_id: pickup.animalId,
      p_box_number: pickup.box,
      p_pickup_sequence: pickupSequence,
      p_delivery_sequence: Math.max(pickupSequence + 1, deliverySequence),
    })
    if (assignmentError) throw assignmentError
  }
}

export async function setDailyRoutePublished(routeId: string, published: boolean) {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { error } = await supabase.from('daily_routes').update({ published }).eq('id', routeId)
  if (error) throw error
}
