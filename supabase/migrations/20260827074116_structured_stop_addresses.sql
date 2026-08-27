alter table public.route_template_stops
  add column if not exists stop_alias text not null default '',
  add column if not exists street text not null default '',
  add column if not exists street_number text not null default '',
  add column if not exists floor text not null default '',
  add column if not exists postal_code text not null default '',
  add column if not exists province text not null default '',
  add column if not exists country text not null default 'España';

alter table public.daily_route_stops
  add column if not exists stop_alias text not null default '',
  add column if not exists street text not null default '',
  add column if not exists street_number text not null default '',
  add column if not exists floor text not null default '',
  add column if not exists postal_code text not null default '',
  add column if not exists province text not null default '',
  add column if not exists country text not null default 'España';
