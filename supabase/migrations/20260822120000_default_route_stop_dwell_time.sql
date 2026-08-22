-- A daily stop includes the expected time to hand over and settle the animals.
alter table public.daily_route_stops
  alter column dwell_minutes set default 15;

update public.daily_route_stops
set dwell_minutes = 15
where dwell_minutes = 0;