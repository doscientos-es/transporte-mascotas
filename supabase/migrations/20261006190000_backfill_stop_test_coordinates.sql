-- Test data: stops created with a province but no coordinates never showed on the landing map.
-- 1) Localities with no coordinates anywhere get approximate city-centre coordinates.
-- 2) Every other stop without coordinates copies them from another stop of the same locality.
-- Only rows with null latitude/longitude are touched. Exact meeting points can be edited later.

create temporary table _stop_fallback_coords (locality text primary key, lat double precision, lng double precision) on commit drop;

insert into _stop_fallback_coords values
  ('Alicante', 38.3452, -0.4810),
  ('Almería', 36.8340, -2.4637),
  ('Barcelona', 41.3874, 2.1686),
  ('Burgos', 42.3439, -3.6969),
  ('Castellón', 39.9864, -0.0513),
  ('Valencia', 39.4699, -0.3763),
  ('Mataró', 41.5381, 2.4445),
  ('Granada-Alfacar', 37.232016, -3.57072),
  ('Ourense', 42.343186, -7.878047);

update public.route_template_stops stop
set latitude = fallback.lat, longitude = fallback.lng
from _stop_fallback_coords fallback
where stop.latitude is null and stop.longitude is null and stop.locality = fallback.locality;

-- Closed itineraries are locked by a trigger (and never shown), so only open routes are touched.
update public.daily_route_stops stop
set latitude = fallback.lat, longitude = fallback.lng
from _stop_fallback_coords fallback
where stop.latitude is null and stop.longitude is null and stop.locality = fallback.locality
  and exists (select 1 from public.daily_routes r where r.id = stop.daily_route_id and r.closed_at is null);

create temporary table _stop_known_coords on commit drop as
select distinct on (locality) locality, latitude, longitude
from (
  select locality, latitude, longitude from public.route_template_stops
  union all
  select locality, latitude, longitude from public.daily_route_stops
) known
where latitude is not null and longitude is not null
order by locality, latitude, longitude;

update public.route_template_stops stop
set latitude = known.latitude, longitude = known.longitude
from _stop_known_coords known
where stop.latitude is null and stop.longitude is null and stop.locality = known.locality;

update public.daily_route_stops stop
set latitude = known.latitude, longitude = known.longitude
from _stop_known_coords known
where stop.latitude is null and stop.longitude is null and stop.locality = known.locality
  and exists (select 1 from public.daily_routes r where r.id = stop.daily_route_id and r.closed_at is null);
