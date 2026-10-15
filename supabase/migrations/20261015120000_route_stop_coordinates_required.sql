-- Every stop needs coordinates: the client portal draws the route from them.
-- All existing rows already have them (checked before writing this migration).
alter table public.route_template_stops
  alter column latitude set not null,
  alter column longitude set not null;

alter table public.daily_route_stops
  alter column latitude set not null,
  alter column longitude set not null;
