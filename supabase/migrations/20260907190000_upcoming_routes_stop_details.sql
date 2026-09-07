-- Clients need full stop details (address, map link, sequence) to render the
-- upcoming route detail page with an itinerary map and stop list.
create or replace function public.list_upcoming_routes()
returns table (
  id uuid, service_date date, route_direction text, template_name text, template_color text,
  localities text[], stops jsonb
)
language sql stable security definer set search_path = '' as $$
  select route.id, route.service_date, route.route_direction, coalesce(template.name, ''), coalesce(template.color, ''),
         coalesce((select array_agg(stop.locality order by stop.sequence) from public.daily_route_stops stop where stop.daily_route_id = route.id), '{}'),
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', stop.id,
             'locality', stop.locality,
             'place', coalesce(stop.meeting_point, ''),
             'mapUrl', coalesce(stop.map_url, ''),
             'minutes', coalesce(stop.minutes_to_next, 0),
             'alias', coalesce(stop.stop_alias, ''),
             'street', coalesce(stop.street, ''),
             'streetNumber', coalesce(stop.street_number, ''),
             'floor', coalesce(stop.floor, ''),
             'postalCode', coalesce(stop.postal_code, ''),
             'province', coalesce(stop.province, ''),
             'country', coalesce(stop.country, 'España'),
             'latitude', stop.latitude,
             'longitude', stop.longitude
           ) order by stop.sequence)
           from public.daily_route_stops stop where stop.daily_route_id = route.id
         ), '[]'::jsonb)
  from public.daily_routes route
  left join public.route_templates template on template.id = route.route_template_id
  where auth.uid() is not null and route.status = 'activa' and route.service_date >= current_date
  order by route.service_date;
$$;
