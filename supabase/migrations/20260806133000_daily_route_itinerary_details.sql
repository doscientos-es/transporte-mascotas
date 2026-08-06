alter table public.daily_route_stops
  add column if not exists stop_kind text not null default 'parada' check (stop_kind in ('parada', 'recogida', 'entrega')),
  add column if not exists dwell_minutes integer not null default 0 check (dwell_minutes >= 0);

alter table public.route_actions
  add column if not exists dwell_minutes integer not null default 15 check (dwell_minutes >= 0);