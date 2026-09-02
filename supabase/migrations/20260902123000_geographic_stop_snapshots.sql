alter table public.route_template_stops
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add constraint route_template_stops_latitude_check check (latitude is null or latitude between -90 and 90),
  add constraint route_template_stops_longitude_check check (longitude is null or longitude between -180 and 180);

alter table public.daily_route_stops
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add constraint daily_route_stops_latitude_check check (latitude is null or latitude between -90 and 90),
  add constraint daily_route_stops_longitude_check check (longitude is null or longitude between -180 and 180);

alter table public.carriage_letters
  add column if not exists origin_latitude double precision,
  add column if not exists origin_longitude double precision,
  add column if not exists destination_latitude double precision,
  add column if not exists destination_longitude double precision;

alter table public.transport_requests
  add column if not exists origin_latitude double precision,
  add column if not exists origin_longitude double precision,
  add column if not exists destination_latitude double precision,
  add column if not exists destination_longitude double precision;

create or replace function public.snapshot_letter_stop_coordinates()
returns trigger language plpgsql security definer set search_path = '' as $$
declare stop public.daily_route_stops;
begin
  select * into stop from public.daily_route_stops where id = new.daily_route_stop_id;
  if new.action_type = 'recogida' then
    update public.carriage_letters
    set origin_latitude = coalesce(origin_latitude, stop.latitude),
        origin_longitude = coalesce(origin_longitude, stop.longitude)
    where id = new.letter_id;
  elsif new.action_type = 'entrega' then
    update public.carriage_letters
    set destination_latitude = coalesce(destination_latitude, stop.latitude),
        destination_longitude = coalesce(destination_longitude, stop.longitude)
    where id = new.letter_id;
  end if;
  return new;
end;
$$;

drop trigger if exists route_actions_snapshot_stop_coordinates on public.route_actions;
create trigger route_actions_snapshot_stop_coordinates
after insert on public.route_actions
for each row execute function public.snapshot_letter_stop_coordinates();

create or replace function public.snapshot_request_stop_coordinates()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.letter_id is not null and new.letter_id is distinct from old.letter_id then
    select origin_latitude, origin_longitude, destination_latitude, destination_longitude
    into new.origin_latitude, new.origin_longitude, new.destination_latitude, new.destination_longitude
    from public.carriage_letters where id = new.letter_id;
  end if;
  return new;
end;
$$;

drop trigger if exists transport_requests_snapshot_stop_coordinates on public.transport_requests;
create trigger transport_requests_snapshot_stop_coordinates
before update of letter_id on public.transport_requests
for each row execute function public.snapshot_request_stop_coordinates();

-- La firma añade la columna stops; PostgreSQL exige recrear la función.
drop function if exists public.list_upcoming_routes();

create or replace function public.list_upcoming_routes()
returns table (
  id uuid, service_date date, route_direction text, template_name text, template_color text,
  localities text[], stops jsonb
)
language sql stable security definer set search_path = '' as $$
  select route.id, route.service_date, route.route_direction, coalesce(template.name, ''), coalesce(template.color, ''),
         coalesce((select array_agg(stop.locality order by stop.sequence) from public.daily_route_stops stop where stop.daily_route_id = route.id), '{}'),
         coalesce((select jsonb_agg(jsonb_build_object('id', stop.id, 'locality', stop.locality, 'latitude', stop.latitude, 'longitude', stop.longitude) order by stop.sequence) from public.daily_route_stops stop where stop.daily_route_id = route.id), '[]'::jsonb)
  from public.daily_routes route
  left join public.route_templates template on template.id = route.route_template_id
  where auth.uid() is not null and route.status = 'activa' and route.service_date >= current_date
  order by route.service_date;
$$;
