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
  const { error: stopsError } = await supabase.from('daily_route_stops').insert(template.stops.map((stop, index) => ({
    daily_route_id: route.id,
    template_stop_id: stop.id,
    sequence: index + 1,
    locality: stop.locality,
    meeting_point: stop.place,
    map_url: stop.mapUrl,
    minutes_to_next: stop.minutes || null,
  })))
  if (stopsError) throw stopsError
}
