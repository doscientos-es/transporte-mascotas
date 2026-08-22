alter table public.daily_routes
  add column if not exists route_direction text not null default 'normal'
    check (route_direction in ('normal', 'inversa'));