alter table public.daily_routes
  add column if not exists start_time time not null default '08:00';
