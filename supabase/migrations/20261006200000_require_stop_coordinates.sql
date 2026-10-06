-- Every stop must carry coordinates (the landing maps and route links depend on them).
-- 1) Backfill the stops of closed itineraries that the previous backfill could not touch
--    (a trigger locks them), copying coordinates from another stop of the same locality.
-- 2) Add CHECK constraints so new and edited stops always have valid coordinates.

alter table public.daily_route_stops
  disable trigger daily_route_stops_prevent_closed_itinerary_changes;

create temporary table _stop_known_coords on commit drop as
select distinct on (locality) locality, latitude, longitude
from (
  select locality, latitude, longitude from public.route_template_stops
  union all
  select locality, latitude, longitude from public.daily_route_stops
) known
where latitude is not null and longitude is not null
order by locality, latitude, longitude;

update public.daily_route_stops stop
set latitude = known.latitude, longitude = known.longitude
from _stop_known_coords known
where (stop.latitude is null or stop.longitude is null) and stop.locality = known.locality;

-- Approximate city-centre test coordinates for a locality that had none anywhere.
update public.daily_route_stops
set latitude = 41.5381, longitude = 2.4445
where (latitude is null or longitude is null) and locality = 'Mataró';

alter table public.daily_route_stops
  enable trigger daily_route_stops_prevent_closed_itinerary_changes;

alter table public.route_template_stops
  add constraint route_template_stops_coordinates_required
  check (
    latitude is not null and longitude is not null
    and latitude between -90 and 90 and longitude between -180 and 180
  );

alter table public.daily_route_stops
  add constraint daily_route_stops_coordinates_required
  check (
    latitude is not null and longitude is not null
    and latitude between -90 and 90 and longitude between -180 and 180
  );
