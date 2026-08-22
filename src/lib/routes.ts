import { supabase } from './supabase';
import type { DailyRoute, Letter, RouteTemplate, ServiceAction, Transporter } from './types';

type TemplateRow = { id: string; name: string; color: string; route_template_stops: Array<{ id: string; sequence: number; locality: string; meeting_point: string; map_url: string | null; minutes_to_next: number | null }> }
type DailyRouteRow = {
  id: string; route_template_id: string | null; service_date: string; status: DailyRoute['status']; transporter_id: string | null
  daily_route_stops: Array<{ id: string; sequence: number; locality: string; meeting_point: string; map_url: string | null; minutes_to_next: number | null; stop_kind: 'parada' | 'recogida' | 'entrega'; dwell_minutes: number }>
}
type RouteActionRow = {
  id: string; daily_route_id: string; daily_route_stop_id: string; letter_id: string; animal_id: string; action_type: 'recogida' | 'entrega'; status: DailyRoute['actions'][number]['status']; dwell_minutes: number; customer_name: string; customer_phone: string; animal_breed: string; animal_species: string; box_number: number | null
}

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

export async function loadTransporters() {
  if (!supabase) return []
  const { data, error } = await supabase.from('profiles').select('id,display_name').eq('role', 'transportista').eq('active', true).order('display_name')
  if (error) throw error
  return (data ?? []).map((profile): Transporter => ({ id: profile.id, displayName: profile.display_name }))
}

export async function loadDailyRoutes() {
  if (!supabase) return []
  const [{ data: routes, error: routesError }, { data: actions, error: actionsError }] = await Promise.all([
    supabase.from('daily_routes').select('id,route_template_id,service_date,status,transporter_id,daily_route_stops(id,sequence,locality,meeting_point,map_url,minutes_to_next,stop_kind,dwell_minutes)').order('service_date'),
    supabase.from('transporter_route_actions').select('id,daily_route_id,daily_route_stop_id,letter_id,animal_id,action_type,status,dwell_minutes,customer_name,customer_phone,animal_breed,animal_species,box_number'),
  ])
  if (routesError) throw routesError
  if (actionsError) throw actionsError
  const actionsByRoute = new Map<string, RouteActionRow[]>()
  const savedActions = (actions ?? []) as RouteActionRow[]
  savedActions.forEach((action) => actionsByRoute.set(action.daily_route_id, [...(actionsByRoute.get(action.daily_route_id) ?? []), action]))
  return ((routes ?? []) as DailyRouteRow[]).map((route): DailyRoute => {
    const stops = route.daily_route_stops.toSorted((a, b) => a.sequence - b.sequence).map((stop) => ({
      id: stop.id, locality: stop.locality, place: stop.meeting_point,
      mapUrl: stop.map_url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.locality)}`,
      minutes: stop.minutes_to_next ?? 0, kind: stop.stop_kind, dwellMinutes: stop.dwell_minutes,
    }))
    return {
      id: route.id, templateId: route.route_template_id ?? '', date: route.service_date, status: route.status, transporterId: route.transporter_id ?? undefined, stops,
      actions: (actionsByRoute.get(route.id) ?? []).map((action) => ({
        id: action.id, letterId: action.letter_id, animalId: action.animal_id, type: action.action_type,
        stop: stops.find((stop) => stop.id === action.daily_route_stop_id)?.locality ?? '', stopId: action.daily_route_stop_id,
        customer: action.customer_name, phone: action.customer_phone, status: action.status, box: action.box_number ?? undefined, dwellMinutes: action.dwell_minutes,
        animalLabel: [action.animal_breed, action.animal_species].filter(Boolean).join(' · ') || undefined,
      })),
    }
  })
}

export async function saveDailyRoute(route: DailyRoute, template: RouteTemplate, userId: string) {
  if (!supabase) return
  const { error: routeError } = await supabase.from('daily_routes').insert({
    id: route.id,
    route_template_id: template.id,
    service_date: route.date,
    status: route.status,
    transporter_id: route.transporterId ?? null,
    created_by: userId,
  })
  if (routeError) throw routeError
  const routeStops = route.stops ?? template.stops.map((stop) => ({ ...stop, kind: 'parada' as const, dwellMinutes: 15 }))
  const { data: savedStops, error: stopsError } = await supabase.from('daily_route_stops').insert(routeStops.map((stop, index) => ({
    daily_route_id: route.id,
    template_stop_id: template.stops.find((templateStop) => templateStop.id === stop.id)?.id ?? null,
    sequence: index + 1,
    locality: stop.locality,
    meeting_point: stop.place,
    map_url: stop.mapUrl,
    minutes_to_next: stop.minutes || null,
    stop_kind: stop.kind,
    dwell_minutes: stop.dwellMinutes,
  }))).select('id,locality,sequence')
  if (stopsError) throw stopsError

  const letterIds = [...new Set(route.actions.map((action) => action.letterId))]
  if (!letterIds.length) return
  const { data: storedLetters, error: lettersError } = await supabase.from('carriage_letters').select('id').in('id', letterIds)
  if (lettersError) throw lettersError
  const allowedLetters = new Set(storedLetters.map((letter) => letter.id))
  const stopIds = new Map(savedStops.map((stop, index) => [routeStops[index].id, stop.id]))
  const stopIdsByLocality = new Map(savedStops.map((stop) => [stop.locality, stop.id]))
  const actions = route.actions.filter((action) => allowedLetters.has(action.letterId) && (stopIds.get(action.stopId ?? '') ?? stopIdsByLocality.get(action.stop))).map((action) => ({
    id: action.id,
    daily_route_id: route.id,
    daily_route_stop_id: stopIds.get(action.stopId ?? '') ?? stopIdsByLocality.get(action.stop),
    letter_id: action.letterId,
    animal_id: action.animalId,
    action_type: action.type,
    status: action.status,
    dwell_minutes: action.dwellMinutes ?? 15,
  }))
  if (!actions.length) return
  const { error: actionsError } = await supabase.from('route_actions').insert(actions)
  if (actionsError) throw actionsError

  const byLetter = new Map<string, DailyRoute['actions']>()
  route.actions.forEach((action) => byLetter.set(action.letterId, [...(byLetter.get(action.letterId) ?? []), action]))
  for (const letterActions of byLetter.values()) {
    const pickup = letterActions.find((action) => action.type === 'recogida' && action.box && allowedLetters.has(action.letterId))
    const delivery = letterActions.find((action) => action.type === 'entrega' && action.box && allowedLetters.has(action.letterId))
    if (!pickup || !delivery || !pickup.box) continue
    const pickupSequence = routeStops.findIndex((stop) => stop.id === pickup.stopId || stop.locality === pickup.stop) + 1
    const deliverySequence = routeStops.findIndex((stop) => stop.id === delivery.stopId || stop.locality === delivery.stop) + 1
    if (!pickupSequence || !deliverySequence) continue
    const { error: assignmentError } = await supabase.rpc('assign_van_box', {
      p_daily_route_id: route.id,
      p_letter_id: pickup.letterId,
      p_animal_id: pickup.animalId,
      p_box_number: pickup.box,
      p_pickup_sequence: pickupSequence,
      p_delivery_sequence: Math.max(pickupSequence + 1, deliverySequence),
    })
    if (assignmentError) throw assignmentError
  }
}

export async function appendLetterToDailyRoute(route: DailyRoute, letter: Letter, actions: ServiceAction[]) {
  if (!supabase || !actions.length) return
  const { data: savedStops, error: stopsError } = await supabase
    .from('daily_route_stops')
    .select('id,locality,sequence')
    .eq('daily_route_id', route.id)
  if (stopsError) throw stopsError

  const stopIdByLocality = new Map((savedStops ?? []).map((stop) => [stop.locality, stop.id]))
  const stopSequenceById = new Map((savedStops ?? []).map((stop) => [stop.id, stop.sequence]))
  const savedStopIds = new Set(stopSequenceById.keys())
  const rows = actions.map((action) => ({
    action,
    stopId: action.stopId && savedStopIds.has(action.stopId) ? action.stopId : stopIdByLocality.get(action.stop),
  })).filter((item): item is { action: ServiceAction; stopId: string } => Boolean(item.stopId))
  if (!rows.length) return

  const { error: actionsError } = await supabase.from('route_actions').insert(rows.map(({ action, stopId }) => ({
    id: action.id,
    daily_route_id: route.id,
    daily_route_stop_id: stopId,
    letter_id: letter.id,
    animal_id: action.animalId,
    action_type: action.type,
    status: action.status,
    dwell_minutes: action.dwellMinutes ?? 15,
  })))
  if (actionsError) throw actionsError

  const pickup = rows.find(({ action }) => action.type === 'recogida' && action.box)
  const delivery = rows.find(({ action }) => action.type === 'entrega' && action.box)
  if (!pickup || !delivery || !pickup.action.box) return
  const pickupSequence = stopSequenceById.get(pickup.stopId)
  const deliverySequence = stopSequenceById.get(delivery.stopId)
  if (!pickupSequence || !deliverySequence) return
  const { error: assignmentError } = await supabase.rpc('assign_van_box', {
    p_daily_route_id: route.id,
    p_letter_id: letter.id,
    p_animal_id: pickup.action.animalId,
    p_box_number: pickup.action.box,
    p_pickup_sequence: pickupSequence,
    p_delivery_sequence: Math.max(pickupSequence + 1, deliverySequence),
  })
  if (assignmentError) throw assignmentError
}
