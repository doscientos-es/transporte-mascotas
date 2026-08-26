-- Returns the first box of the requested size that stays free along the whole
-- segment, falling back to a larger band when the exact one is full.
create or replace function public.suggest_free_box(
  p_daily_route_id uuid,
  p_size public.animal_size,
  p_pickup_sequence integer,
  p_delivery_sequence integer
)
returns integer language sql stable set search_path = '' as $$
  select candidate.box
  from generate_series(1, 72) as candidate(box)
  where (
      public.box_matches_animal_size(candidate.box, p_size)
      or (p_size = 'pequeno' and public.box_matches_animal_size(candidate.box, 'mediano'))
      or public.box_matches_animal_size(candidate.box, 'grande')
    )
    and not exists (
      select 1 from public.van_assignments assignment
      where assignment.daily_route_id = p_daily_route_id
        and assignment.box_number = candidate.box
        and int4range(assignment.pickup_sequence, assignment.delivery_sequence, '[]')
            && int4range(p_pickup_sequence, p_delivery_sequence, '[]')
    )
  order by case
    when public.box_matches_animal_size(candidate.box, p_size) then 0
    when p_size = 'pequeno' and public.box_matches_animal_size(candidate.box, 'mediano') then 1
    else 2
  end, candidate.box
  limit 1;
$$;

revoke all on function public.suggest_free_box(uuid, public.animal_size, integer, integer) from public, anon;
grant execute on function public.suggest_free_box(uuid, public.animal_size, integer, integer) to authenticated;

alter table public.transport_requests enable row level security;
alter table public.transport_request_animals enable row level security;
alter table public.transport_request_notifications enable row level security;
alter table public.animal_size_thresholds enable row level security;

create policy "requests owner read" on public.transport_requests
  for select to authenticated using (public.is_admin() or requester_id = (select auth.uid()));
create policy "requests owner insert" on public.transport_requests
  for insert to authenticated with check (requester_id = (select auth.uid()));
create policy "requests admin manage" on public.transport_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "request animals owner read" on public.transport_request_animals
  for select to authenticated using (public.is_admin() or exists (
    select 1 from public.transport_requests request
    where request.id = request_id and request.requester_id = (select auth.uid())
  ));
create policy "request animals owner insert" on public.transport_request_animals
  for insert to authenticated with check (exists (
    select 1 from public.transport_requests request
    where request.id = request_id
      and request.requester_id = (select auth.uid())
      and request.status = 'pago_pendiente'
  ));
create policy "request animals admin manage" on public.transport_request_animals
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "thresholds admin manage" on public.animal_size_thresholds
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.transport_request_notifications from public, anon, authenticated;

grant select, insert on public.transport_requests, public.transport_request_animals to authenticated;
grant update, delete on public.transport_requests, public.transport_request_animals to authenticated;
grant select, update on public.animal_size_thresholds to authenticated;

-- Clients may plan ahead, but only with the public face of a route: no letters,
-- no phone numbers and no box assignments. Exposed through a definer function so
-- the existing per-transportista policies on daily_routes stay untouched.
create or replace function public.list_upcoming_routes()
returns table (
  id uuid,
  service_date date,
  route_direction text,
  template_name text,
  template_color text,
  localities text[]
)
language sql stable security definer set search_path = '' as $$
  select route.id,
         route.service_date,
         route.route_direction,
         coalesce(template.name, ''),
         coalesce(template.color, ''),
         coalesce((
           select array_agg(stop.locality order by stop.sequence)
           from public.daily_route_stops stop
           where stop.daily_route_id = route.id
         ), '{}')
  from public.daily_routes route
  left join public.route_templates template on template.id = route.route_template_id
  where auth.uid() is not null
    and route.status in ('borrador', 'activa')
    and route.service_date >= current_date
  order by route.service_date;
$$;

revoke all on function public.list_upcoming_routes() from public, anon;
grant execute on function public.list_upcoming_routes() to authenticated;
