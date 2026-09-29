-- Public visitors can review published routes and prices without receiving an
-- authenticated session. The request itself will use a least-privileged guest
-- session so existing ownership and payment policies continue to apply.

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    case
      when coalesce(new.is_anonymous, false)
        or new.raw_user_meta_data ->> 'account_type' = 'user'
      then 'user'::public.app_role
      else 'transportista'::public.app_role
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

-- This RPC deliberately omits exact meeting-point addresses and map links.
create or replace function public.list_public_transport_routes()
returns table (
  id uuid,
  service_date date,
  route_direction text,
  template_name text,
  template_color text,
  localities text[],
  stops jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select route.id,
         route.service_date,
         route.route_direction,
         coalesce(template.name, ''),
         coalesce(template.color, ''),
         coalesce((
           select array_agg(stop.locality order by stop.sequence)
           from public.daily_route_stops stop
           where stop.daily_route_id = route.id
         ), '{}'),
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', stop.id,
             'locality', stop.locality,
             'latitude', stop.latitude,
             'longitude', stop.longitude
           ) order by stop.sequence)
           from public.daily_route_stops stop
           where stop.daily_route_id = route.id
         ), '[]'::jsonb)
  from public.daily_routes route
  left join public.route_templates template on template.id = route.route_template_id
  where route.status = 'activa'
    and route.service_date >= current_date
  order by route.service_date;
$$;

revoke all on function public.list_public_transport_routes() from public, anon, authenticated;
grant execute on function public.list_public_transport_routes() to anon, authenticated;

drop policy if exists "transport box catalog public read" on public.transport_box_catalog;
create policy "transport box catalog public read" on public.transport_box_catalog
  for select to anon using (true);
grant select on public.transport_box_catalog to anon;

notify pgrst, 'reload schema';