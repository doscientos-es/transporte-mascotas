-- The client portal needs the departure time and stop waiting times to show the
-- actual estimated calendar day and time at each stop, including after midnight.
drop function if exists public.list_upcoming_routes();

create function public.list_upcoming_routes()
returns table (
  id uuid,
  service_date date,
  start_time time,
  route_direction text,
  template_name text,
  template_color text,
  localities text[],
  stops jsonb,
  end_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select route.id,
         route.service_date,
         route.start_time,
         route.route_direction,
         coalesce(template.name, ''),
         coalesce(template.color, ''),
         coalesce((
           select array_agg(stop.locality order by stop.sequence)
           from public.daily_route_stops stop
           where stop.daily_route_id = route.id
         ), '{}'),
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', stop.id,
             'locality', stop.locality,
             'place', coalesce(stop.meeting_point, ''),
             'mapUrl', coalesce(stop.map_url, ''),
             'minutes', coalesce(stop.minutes_to_next, 0),
             'dwellMinutes', coalesce(stop.dwell_minutes, 0),
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
           from public.daily_route_stops stop
           where stop.daily_route_id = route.id
         ), '[]'::jsonb),
         greatest(route.service_date, public.route_end_date(route.id))
  from public.daily_routes route
  left join public.route_templates template on template.id = route.route_template_id
  where auth.uid() is not null
    and route.status = 'activa'
    and route.service_date >= current_date
  order by route.service_date;
$$;

revoke all on function public.list_upcoming_routes() from public, anon;
grant execute on function public.list_upcoming_routes() to authenticated;

-- Public route previews omit addresses and map links, but need schedule data to
-- show the correct calendar day and estimated arrival time for each locality.
drop function if exists public.list_public_transport_routes();

create function public.list_public_transport_routes()
returns table (
  id uuid,
  service_date date,
  start_time time,
  route_direction text,
  template_name text,
  template_color text,
  localities text[],
  stops jsonb,
  end_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select route.id,
         route.service_date,
         route.start_time,
         route.route_direction,
         coalesce(template.name, ''),
         coalesce(template.color, ''),
         coalesce((
           select array_agg(stop.locality order by stop.sequence)
           from public.daily_route_stops stop
           where stop.daily_route_id = route.id
         ), '{}'),
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', stop.id,
             'locality', stop.locality,
             'latitude', stop.latitude,
             'longitude', stop.longitude,
             'minutes', coalesce(stop.minutes_to_next, 0),
             'dwellMinutes', coalesce(stop.dwell_minutes, 0)
           ) order by stop.sequence)
           from public.daily_route_stops stop
           where stop.daily_route_id = route.id
         ), '[]'::jsonb),
         greatest(route.service_date, public.route_end_date(route.id))
  from public.daily_routes route
  left join public.route_templates template on template.id = route.route_template_id
  where route.status = 'activa'
    and route.service_date >= current_date
  order by route.service_date;
$$;

revoke all on function public.list_public_transport_routes() from public, anon, authenticated;
grant execute on function public.list_public_transport_routes() to anon, authenticated;

notify pgrst, 'reload schema';