-- Snapshot the pickup and delivery stop coordinates when the request is created
-- so the client can open the exact location before paying.
create or replace function public.snapshot_new_request_stop_coordinates()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  pickup public.daily_route_stops;
  delivery public.daily_route_stops;
begin
  if new.daily_route_id is null then return new; end if;
  select * into pickup from public.daily_route_stops
  where daily_route_id = new.daily_route_id and locality = new.origin_text
  order by sequence limit 1;
  select * into delivery from public.daily_route_stops
  where daily_route_id = new.daily_route_id and locality = new.destination_text
    and sequence > coalesce(pickup.sequence, 0)
  order by sequence limit 1;
  new.origin_latitude := coalesce(new.origin_latitude, pickup.latitude);
  new.origin_longitude := coalesce(new.origin_longitude, pickup.longitude);
  new.destination_latitude := coalesce(new.destination_latitude, delivery.latitude);
  new.destination_longitude := coalesce(new.destination_longitude, delivery.longitude);
  return new;
end;
$$;

revoke all on function public.snapshot_new_request_stop_coordinates() from public, anon, authenticated;

drop trigger if exists transport_requests_snapshot_new_stop_coordinates on public.transport_requests;
create trigger transport_requests_snapshot_new_stop_coordinates
before insert on public.transport_requests
for each row execute function public.snapshot_new_request_stop_coordinates();

-- Keep the creation snapshot when the carriage letter has no coordinates.
create or replace function public.snapshot_request_stop_coordinates()
returns trigger language plpgsql security definer set search_path = '' as $$
declare letter public.carriage_letters;
begin
  if new.letter_id is not null and new.letter_id is distinct from old.letter_id then
    select * into letter from public.carriage_letters where id = new.letter_id;
    new.origin_latitude := coalesce(letter.origin_latitude, new.origin_latitude);
    new.origin_longitude := coalesce(letter.origin_longitude, new.origin_longitude);
    new.destination_latitude := coalesce(letter.destination_latitude, new.destination_latitude);
    new.destination_longitude := coalesce(letter.destination_longitude, new.destination_longitude);
  end if;
  return new;
end;
$$;

update public.transport_requests request
set origin_latitude = coalesce(request.origin_latitude, pickup.latitude),
    origin_longitude = coalesce(request.origin_longitude, pickup.longitude),
    destination_latitude = coalesce(request.destination_latitude, delivery.latitude),
    destination_longitude = coalesce(request.destination_longitude, delivery.longitude)
from public.daily_route_stops pickup, public.daily_route_stops delivery
where request.origin_latitude is null
  and pickup.daily_route_id = request.daily_route_id and pickup.locality = request.origin_text
  and delivery.daily_route_id = request.daily_route_id and delivery.locality = request.destination_text
  and delivery.sequence > pickup.sequence;
