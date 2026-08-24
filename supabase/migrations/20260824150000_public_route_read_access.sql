-- Public booking may only read routes explicitly published by an administrator.
grant select on public.daily_routes, public.daily_route_stops, public.route_templates to anon;

create policy "public published routes read" on public.daily_routes
  for select to anon
  using (published and status in ('borrador', 'activa'));

create policy "public published route stops read" on public.daily_route_stops
  for select to anon
  using (active and exists (
    select 1 from public.daily_routes route
    where route.id = daily_route_id and route.published and route.status in ('borrador', 'activa')
  ));

create policy "public templates for published routes read" on public.route_templates
  for select to anon
  using (exists (
    select 1 from public.daily_routes route
    where route.route_template_id = route_templates.id and route.published and route.status in ('borrador', 'activa')
  ));
