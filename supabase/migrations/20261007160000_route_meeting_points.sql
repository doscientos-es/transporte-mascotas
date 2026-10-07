create table public.route_meeting_points (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  locality text not null check (length(btrim(locality)) > 0),
  instructions text not null default '',
  street text not null default '',
  street_number text not null default '',
  floor text not null default '',
  postal_code text not null default '',
  province text not null default '',
  country text not null default 'España',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now()
);

create unique index route_meeting_points_name_locality_idx
  on public.route_meeting_points (lower(name), lower(locality));
create index route_meeting_points_locality_name_idx
  on public.route_meeting_points (locality, name);

alter table public.route_meeting_points enable row level security;
revoke all on public.route_meeting_points from public, anon;
grant select, insert, update, delete on public.route_meeting_points to authenticated;

create policy "meeting points staff read"
  on public.route_meeting_points for select to authenticated using (true);
create policy "meeting points admin insert"
  on public.route_meeting_points for insert to authenticated with check (public.is_admin());
create policy "meeting points admin update"
  on public.route_meeting_points for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "meeting points admin delete"
  on public.route_meeting_points for delete to authenticated using (public.is_admin());

with source_points as (
  select
    stop.*,
    concat_ws(
      ' · ',
      nullif(btrim(stop.stop_alias), ''),
      nullif(btrim(stop.meeting_point), '')
    ) as instructions
  from public.route_template_stops stop
  join public.route_templates template on template.id = stop.route_template_id
  where lower(btrim(template.name)) = 'ruta completa'
    and nullif(btrim(stop.locality), '') is not null
    and (nullif(btrim(stop.stop_alias), '') is not null or nullif(btrim(stop.meeting_point), '') is not null)
    and stop.latitude is not null
    and stop.longitude is not null
), distinct_points as (
  select distinct on (
    lower(btrim(locality)),
    lower(btrim(instructions)),
    round(latitude::numeric, 5),
    round(longitude::numeric, 5)
  ) *
  from source_points
  order by
    lower(btrim(locality)),
    lower(btrim(instructions)),
    round(latitude::numeric, 5),
    round(longitude::numeric, 5),
    length(street) desc,
    length(postal_code) desc,
    sequence
)
insert into public.route_meeting_points (
  name,
  locality,
  instructions,
  street,
  street_number,
  floor,
  postal_code,
  province,
  country,
  latitude,
  longitude
)
select
  coalesce(nullif(btrim(stop_alias), ''), nullif(btrim(meeting_point), ''), locality),
  locality,
  instructions,
  street,
  street_number,
  floor,
  postal_code,
  province,
  country,
  latitude,
  longitude
from distinct_points;