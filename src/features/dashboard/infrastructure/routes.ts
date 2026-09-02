import { DEFAULT_STOP_DWELL_MINUTES } from '@/shared/constants/route-defaults'
import { requireSupabase } from '@/shared/infrastructure/supabase'
import type {
  DailyRoute,
  DailyRouteStop,
  Letter,
  RouteDirection,
  RouteTemplate,
  ServiceAction,
  Transporter,
} from '@/shared/types'

type StoredStop = {
  id: string
  sequence: number
  locality: string
  meeting_point: string
  map_url: string | null
  minutes_to_next: number | null
  stop_alias: string
  street: string
  street_number: string
  floor: string
  postal_code: string
  province: string
  country: string
  latitude: number | null
  longitude: number | null
}
type TemplateRow = { id: string; name: string; color: string; route_template_stops: StoredStop[] }
type DailyRouteRow = {
  id: string
  route_template_id: string | null
  service_date: string
  status: DailyRoute['status']
  closed_at: string | null
  transporter_id: string | null
  route_direction: RouteDirection
  daily_route_stops: Array<
    StoredStop & { stop_kind: 'parada' | 'recogida' | 'entrega'; dwell_minutes: number }
  >
}
type RouteActionRow = {
  id: string
  daily_route_id: string
  daily_route_stop_id: string
  letter_id: string
  animal_id: string
  action_type: 'recogida' | 'entrega'
  status: DailyRoute['actions'][number]['status']
  dwell_minutes: number
  customer_name: string
  customer_phone: string
  animal_breed: string
  animal_species: string
  box_number: number | null
}

function mapUrlFor(
  stop: Pick<
    StoredStop,
    | 'stop_alias'
    | 'street'
    | 'street_number'
    | 'floor'
    | 'postal_code'
    | 'locality'
    | 'province'
    | 'country'
    | 'latitude'
    | 'longitude'
  >,
) {
  if (typeof stop.latitude === 'number' && typeof stop.longitude === 'number')
    return `https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`
  const address = [
    [stop.street, stop.street_number].filter(Boolean).join(' '),
    stop.postal_code,
    stop.locality,
    stop.province,
    stop.country || 'España',
  ].filter(Boolean)
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((address.length ? address : [stop.stop_alias]).join(', '))}`
}

function mapStop(stop: StoredStop) {
  return {
    id: stop.id,
    locality: stop.locality,
    place: stop.meeting_point,
    mapUrl: stop.street || stop.postal_code ? mapUrlFor(stop) : (stop.map_url ?? mapUrlFor(stop)),
    minutes: stop.minutes_to_next ?? 0,
    alias: stop.stop_alias,
    street: stop.street,
    streetNumber: stop.street_number,
    floor: stop.floor,
    postalCode: stop.postal_code,
    province: stop.province,
    country: stop.country,
    latitude: stop.latitude ?? undefined,
    longitude: stop.longitude ?? undefined,
  }
}

function mapTemplate(row: TemplateRow): RouteTemplate {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    stops: row.route_template_stops.toSorted((a, b) => a.sequence - b.sequence).map(mapStop),
  }
}

export async function saveRouteTemplate(template: RouteTemplate) {
  const { error } = await requireSupabase()
    .from('route_templates')
    .insert({ id: template.id, name: template.name, color: template.color })
  if (error) throw error
  return template
}

export async function updateRouteTemplate(template: Pick<RouteTemplate, 'id' | 'name' | 'color'>) {
  const { error } = await requireSupabase()
    .from('route_templates')
    .update({ name: template.name, color: template.color })
    .eq('id', template.id)
  if (error) throw error
}

export async function deleteRouteTemplate(templateId: string) {
  const { error } = await requireSupabase().from('route_templates').delete().eq('id', templateId)
  if (error) throw error
}

export async function addRouteTemplateStop(
  templateId: string,
  stop: RouteTemplate['stops'][number],
  sequence: number,
) {
  const { error } = await requireSupabase()
    .from('route_template_stops')
    .insert({
      id: stop.id,
      route_template_id: templateId,
      sequence,
      locality: stop.locality,
      meeting_point: stop.place,
      map_url: stop.mapUrl,
      minutes_to_next: stop.minutes || null,
      stop_alias: stop.alias ?? '',
      street: stop.street ?? '',
      street_number: stop.streetNumber ?? '',
      floor: stop.floor ?? '',
      postal_code: stop.postalCode ?? '',
      province: stop.province ?? '',
      country: stop.country ?? 'España',
      latitude: stop.latitude ?? null,
      longitude: stop.longitude ?? null,
    })
  if (error) throw error
}

export async function updateRouteTemplateStopOrder(
  templateId: string,
  stops: RouteTemplate['stops'],
) {
  const database = requireSupabase()
  const temporarySequenceStart = 100000
  const temporaryUpdates = await Promise.all(
    stops.map((stop, index) =>
      database
        .from('route_template_stops')
        .update({ sequence: temporarySequenceStart + index })
        .eq('id', stop.id)
        .eq('route_template_id', templateId),
    ),
  )
  const temporaryError = temporaryUpdates.find((result) => result.error)?.error
  if (temporaryError) throw temporaryError

  const finalUpdates = await Promise.all(
    stops.map((stop, index) =>
      database
        .from('route_template_stops')
        .update({ sequence: index + 1 })
        .eq('id', stop.id)
        .eq('route_template_id', templateId),
    ),
  )
  const finalError = finalUpdates.find((result) => result.error)?.error
  if (finalError) throw finalError
}

export async function loadRouteTemplates() {
  const { data, error } = await requireSupabase()
    .from('route_templates')
    .select(
      'id,name,color,route_template_stops(id,sequence,locality,meeting_point,map_url,minutes_to_next,stop_alias,street,street_number,floor,postal_code,province,country,latitude,longitude)',
    )
    .order('name')
  if (error) throw error
  return ((data ?? []) as TemplateRow[]).map(mapTemplate)
}

export async function loadTransporters() {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id,display_name')
    .eq('role', 'transportista')
    .eq('active', true)
    .order('display_name')
  if (error) throw error
  return (data ?? []).map((profile): Transporter => ({
    id: profile.id,
    displayName: profile.display_name,
  }))
}

export async function promoteTransporterToAdmin(profileId: string) {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', profileId)
    .eq('role', 'transportista')
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Este perfil ya no es un transportista activo.')
}

export async function loadDailyRoutes() {
  const database = requireSupabase()
  const [{ data: routes, error: routesError }, { data: actions, error: actionsError }] =
    await Promise.all([
      database
        .from('daily_routes')
        .select(
          'id,route_template_id,service_date,status,closed_at,transporter_id,route_direction,daily_route_stops(id,sequence,locality,meeting_point,map_url,minutes_to_next,stop_alias,street,street_number,floor,postal_code,province,country,latitude,longitude,stop_kind,dwell_minutes)',
        )
        .order('service_date'),
      database
        .from('transporter_route_actions')
        .select(
          'id,daily_route_id,daily_route_stop_id,letter_id,animal_id,action_type,status,dwell_minutes,customer_name,customer_phone,animal_breed,animal_species,box_number',
        ),
    ])
  if (routesError) throw routesError
  if (actionsError) throw actionsError
  const actionsByRoute = new Map<string, RouteActionRow[]>()
  const savedActions = (actions ?? []) as RouteActionRow[]
  savedActions.forEach((action) =>
    actionsByRoute.set(action.daily_route_id, [
      ...(actionsByRoute.get(action.daily_route_id) ?? []),
      action,
    ]),
  )
  return ((routes ?? []) as DailyRouteRow[]).map((route): DailyRoute => {
    const stops = route.daily_route_stops
      .toSorted((a, b) => a.sequence - b.sequence)
      .map((stop) => ({ ...mapStop(stop), kind: stop.stop_kind, dwellMinutes: stop.dwell_minutes }))
    return {
      id: route.id,
      templateId: route.route_template_id ?? '',
      date: route.service_date,
      status: route.status,
      closedAt: route.closed_at ?? undefined,
      transporterId: route.transporter_id ?? undefined,
      direction: route.route_direction,
      stops,
      actions: (actionsByRoute.get(route.id) ?? []).map((action) => ({
        id: action.id,
        letterId: action.letter_id,
        animalId: action.animal_id,
        type: action.action_type,
        stop: stops.find((stop) => stop.id === action.daily_route_stop_id)?.locality ?? '',
        stopId: action.daily_route_stop_id,
        customer: action.customer_name,
        phone: action.customer_phone,
        status: action.status,
        box: action.box_number ?? undefined,
        dwellMinutes: action.dwell_minutes,
        animalLabel:
          [action.animal_breed, action.animal_species].filter(Boolean).join(' · ') || undefined,
      })),
    }
  })
}

export async function closeDailyRoute(routeId: string) {
  const { data, error } = await requireSupabase().rpc('close_daily_route', {
    p_daily_route_id: routeId,
  })
  if (error) throw error
  return data as { closedAt?: string; notificationsQueued?: number } | null
}

export async function saveDailyRoute(route: DailyRoute, template: RouteTemplate, userId: string) {
  const database = requireSupabase()
  const { error: routeError } = await database.from('daily_routes').insert({
    id: route.id,
    route_template_id: template.id,
    service_date: route.date,
    status: route.status,
    transporter_id: route.transporterId ?? null,
    route_direction: route.direction ?? 'normal',
    created_by: userId,
  })
  if (routeError) throw routeError
  const routeStops =
    route.stops ??
    template.stops.map((stop) => ({
      ...stop,
      kind: 'parada' as const,
      dwellMinutes: DEFAULT_STOP_DWELL_MINUTES,
    }))
  const { data: savedStops, error: stopsError } = await database
    .from('daily_route_stops')
    .insert(
      routeStops.map((stop, index) => ({
        daily_route_id: route.id,
        template_stop_id:
          template.stops.find((templateStop) => templateStop.id === stop.id)?.id ?? null,
        sequence: index + 1,
        locality: stop.locality,
        meeting_point: stop.place,
        map_url: stop.mapUrl,
        minutes_to_next: stop.minutes || null,
        stop_alias: stop.alias ?? '',
        street: stop.street ?? '',
        street_number: stop.streetNumber ?? '',
        floor: stop.floor ?? '',
        postal_code: stop.postalCode ?? '',
        province: stop.province ?? '',
        country: stop.country ?? 'España',
        latitude: stop.latitude ?? null,
        longitude: stop.longitude ?? null,
        stop_kind: stop.kind,
        dwell_minutes: stop.dwellMinutes,
      })),
    )
    .select('id,locality,sequence')
  if (stopsError) throw stopsError
  const savedRoute: DailyRoute = {
    ...route,
    stops: routeStops.map((stop, index) => ({ ...stop, id: savedStops[index]?.id ?? stop.id })),
  }

  const letterIds = [...new Set(route.actions.map((action) => action.letterId))]
  if (!letterIds.length) return savedRoute
  const { data: storedLetters, error: lettersError } = await database
    .from('carriage_letters')
    .select('id')
    .in('id', letterIds)
  if (lettersError) throw lettersError
  const allowedLetters = new Set(storedLetters.map((letter) => letter.id))
  const stopIds = new Map(savedStops.map((stop, index) => [routeStops[index].id, stop.id]))
  const stopIdsByLocality = new Map(savedStops.map((stop) => [stop.locality, stop.id]))
  const actions = route.actions
    .filter(
      (action) =>
        allowedLetters.has(action.letterId) &&
        (stopIds.get(action.stopId ?? '') ?? stopIdsByLocality.get(action.stop)),
    )
    .map((action) => ({
      id: action.id,
      daily_route_id: route.id,
      daily_route_stop_id: stopIds.get(action.stopId ?? '') ?? stopIdsByLocality.get(action.stop),
      letter_id: action.letterId,
      animal_id: action.animalId,
      action_type: action.type,
      status: action.status,
      dwell_minutes: action.dwellMinutes ?? 15,
    }))
  if (!actions.length) return savedRoute
  const { error: actionsError } = await database.from('route_actions').insert(actions)
  if (actionsError) throw actionsError

  const byLetter = new Map<string, DailyRoute['actions']>()
  route.actions.forEach((action) =>
    byLetter.set(action.letterId, [...(byLetter.get(action.letterId) ?? []), action]),
  )
  for (const letterActions of byLetter.values()) {
    const pickup = letterActions.find(
      (action) => action.type === 'recogida' && action.box && allowedLetters.has(action.letterId),
    )
    const delivery = letterActions.find(
      (action) => action.type === 'entrega' && action.box && allowedLetters.has(action.letterId),
    )
    if (!pickup || !delivery || !pickup.box) continue
    const pickupSequence =
      routeStops.findIndex((stop) => stop.id === pickup.stopId || stop.locality === pickup.stop) + 1
    const deliverySequence =
      routeStops.findIndex(
        (stop) => stop.id === delivery.stopId || stop.locality === delivery.stop,
      ) + 1
    if (!pickupSequence || !deliverySequence) continue
    const { error: assignmentError } = await database.rpc('assign_van_box', {
      p_daily_route_id: route.id,
      p_letter_id: pickup.letterId,
      p_animal_id: pickup.animalId,
      p_box_number: pickup.box,
      p_pickup_sequence: pickupSequence,
      p_delivery_sequence: Math.max(pickupSequence + 1, deliverySequence),
    })
    if (assignmentError) throw assignmentError
  }
  return savedRoute
}

export async function updateDailyRouteStops(routeId: string, stops: DailyRouteStop[]) {
  const database = requireSupabase()
  const temporarySequenceStart = 100000
  const temporaryUpdates = await Promise.all(
    stops.map((stop, index) =>
      database
        .from('daily_route_stops')
        .update({ sequence: temporarySequenceStart + index })
        .eq('id', stop.id)
        .eq('daily_route_id', routeId),
    ),
  )
  const temporaryError = temporaryUpdates.find((result) => result.error)?.error
  if (temporaryError) throw temporaryError

  const updates = await Promise.all(
    stops.map((stop, index) =>
      database
        .from('daily_route_stops')
        .update({
          sequence: index + 1,
          dwell_minutes: stop.dwellMinutes,
          minutes_to_next: stop.minutes || null,
          locality: stop.locality,
          meeting_point: stop.place,
          map_url: stop.mapUrl,
          stop_alias: stop.alias ?? '',
          street: stop.street ?? '',
          street_number: stop.streetNumber ?? '',
          floor: stop.floor ?? '',
          postal_code: stop.postalCode ?? '',
          province: stop.province ?? '',
          country: stop.country ?? 'España',
          latitude: stop.latitude ?? null,
          longitude: stop.longitude ?? null,
        })
        .eq('id', stop.id)
        .eq('daily_route_id', routeId)
        .select('id'),
    ),
  )
  const failure = updates.find(({ error, data }) => error || !data?.length)
  if (failure?.error) throw failure.error
  if (failure) throw new Error('No se ha podido guardar una de las paradas de la ruta.')
}

export async function addDailyRouteStop(routeId: string, stop: DailyRouteStop, sequence: number) {
  const { error } = await requireSupabase()
    .from('daily_route_stops')
    .insert({
      id: stop.id,
      daily_route_id: routeId,
      sequence,
      locality: stop.locality,
      meeting_point: stop.place,
      map_url: stop.mapUrl,
      minutes_to_next: stop.minutes || null,
      stop_alias: stop.alias ?? '',
      street: stop.street ?? '',
      street_number: stop.streetNumber ?? '',
      floor: stop.floor ?? '',
      postal_code: stop.postalCode ?? '',
      province: stop.province ?? '',
      country: stop.country ?? 'España',
      latitude: stop.latitude ?? null,
      longitude: stop.longitude ?? null,
      stop_kind: stop.kind,
      dwell_minutes: stop.dwellMinutes,
    })
  if (error) throw error
}

export async function deleteDailyRouteStop(routeId: string, stopId: string) {
  const database = requireSupabase()
  const { count, error: actionsError } = await database
    .from('route_actions')
    .select('id', { count: 'exact', head: true })
    .eq('daily_route_id', routeId)
    .eq('daily_route_stop_id', stopId)
  if (actionsError) throw actionsError
  if (count) throw new Error('No se puede eliminar una parada con servicios asociados.')
  const { error } = await database
    .from('daily_route_stops')
    .delete()
    .eq('id', stopId)
    .eq('daily_route_id', routeId)
  if (error) throw error
}

export async function appendLetterToDailyRoute(
  route: DailyRoute,
  letter: Letter,
  actions: ServiceAction[],
) {
  if (!actions.length) return
  const database = requireSupabase()
  const { data: savedStops, error: stopsError } = await database
    .from('daily_route_stops')
    .select('id,locality,sequence')
    .eq('daily_route_id', route.id)
  if (stopsError) throw stopsError

  const stopIdByLocality = new Map((savedStops ?? []).map((stop) => [stop.locality, stop.id]))
  const stopSequenceById = new Map((savedStops ?? []).map((stop) => [stop.id, stop.sequence]))
  const savedStopIds = new Set(stopSequenceById.keys())
  const rows = actions
    .map((action) => ({
      action,
      stopId:
        action.stopId && savedStopIds.has(action.stopId)
          ? action.stopId
          : stopIdByLocality.get(action.stop),
    }))
    .filter((item): item is { action: ServiceAction; stopId: string } => Boolean(item.stopId))
  if (!rows.length) return

  const { error: actionsError } = await database.from('route_actions').insert(
    rows.map(({ action, stopId }) => ({
      id: action.id,
      daily_route_id: route.id,
      daily_route_stop_id: stopId,
      letter_id: letter.id,
      animal_id: action.animalId,
      action_type: action.type,
      status: action.status,
      dwell_minutes: action.dwellMinutes ?? 15,
    })),
  )
  if (actionsError) throw actionsError

  const pickup = rows.find(({ action }) => action.type === 'recogida' && action.box)
  const delivery = rows.find(({ action }) => action.type === 'entrega' && action.box)
  if (!pickup || !delivery || !pickup.action.box) return
  const pickupSequence = stopSequenceById.get(pickup.stopId)
  const deliverySequence = stopSequenceById.get(delivery.stopId)
  if (!pickupSequence || !deliverySequence) return
  const { error: assignmentError } = await database.rpc('assign_van_box', {
    p_daily_route_id: route.id,
    p_letter_id: letter.id,
    p_animal_id: pickup.action.animalId,
    p_box_number: pickup.action.box,
    p_pickup_sequence: pickupSequence,
    p_delivery_sequence: Math.max(pickupSequence + 1, deliverySequence),
  })
  if (assignmentError) throw assignmentError
}

export async function reassignVanBox(route: DailyRoute, letterId: string, boxNumber: number) {
  const letterActions = route.actions.filter((action) => action.letterId === letterId)
  const pickup = letterActions.find((action) => action.type === 'recogida')
  const delivery = letterActions.find(
    (action) => action.type === 'entrega' && action.animalId === pickup?.animalId,
  )
  if (!pickup || !delivery)
    throw new Error('La carta debe tener una recogida y una entrega para poder cambiar de box.')

  const routeStops = route.stops ?? []
  const stopSequence = (action: ServiceAction) =>
    routeStops.findIndex((stop) => stop.id === action.stopId || stop.locality === action.stop) + 1
  const pickupSequence = stopSequence(pickup)
  const deliverySequence = stopSequence(delivery)
  if (!pickupSequence || !deliverySequence)
    throw new Error('No se ha podido determinar el tramo de la ruta para esta carta.')

  const { error } = await requireSupabase().rpc('assign_van_box', {
    p_daily_route_id: route.id,
    p_letter_id: letterId,
    p_animal_id: pickup.animalId,
    p_box_number: boxNumber,
    p_pickup_sequence: pickupSequence,
    p_delivery_sequence: Math.max(pickupSequence + 1, deliverySequence),
  })
  if (error) throw error
}
